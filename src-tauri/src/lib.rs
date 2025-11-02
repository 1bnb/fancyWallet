use serde::{Deserialize, Serialize};
use secp256k1::{Secp256k1, SecretKey, PublicKey};
use rand::{rngs::OsRng, Rng};
use sha3::{Keccak256, Digest};
use tauri::{AppHandle, Emitter};
use std::fs::{OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{OnceLock, Arc, atomic::{AtomicBool, Ordering}};

/// 全局会话时间戳（用于文件名）
static SESSION_TIMESTAMP: OnceLock<String> = OnceLock::new();

/// 全局取消标志
static CANCEL_FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();

/// 钱包信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Wallet {
    /// 钱包地址
    pub address: String,
    /// 私钥
    pub private_key: String,
    /// 尝试次数
    pub attempts: u64,
    /// 耗时（毫秒）
    pub duration: u64,
}

/**
 * 获取会话时间戳（用于在同一次运行中使用相同的文件名）
 */
fn get_session_timestamp() -> &'static str {
    SESSION_TIMESTAMP.get_or_init(|| {
        chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
    })
}

/**
 * 获取全局取消标志
 */
fn get_cancel_flag() -> Arc<AtomicBool> {
    CANCEL_FLAG.get_or_init(|| Arc::new(AtomicBool::new(false))).clone()
}

/**
 * 将以太坊地址转换为Checksum格式（EIP-55）
 * 严格区分大小写
 * 
 * @param address - 小写的以太坊地址（不含0x前缀）
 * @returns Checksum格式的地址
 */
fn to_checksum_address(address: &str) -> String {
    // 对地址进行Keccak256哈希
    let mut hasher = Keccak256::new();
    hasher.update(address.as_bytes());
    let hash = hasher.finalize();
    
    // 构建checksum地址
    let mut checksum = String::with_capacity(40);
    for (i, char) in address.chars().enumerate() {
        let byte = hash[i / 2];
        let nibble = if i % 2 == 0 {
            (byte >> 4) & 0xf
        } else {
            byte & 0xf
        };
        
        // 如果nibble >= 8，则转换为大写
        if nibble >= 8 {
            checksum.push(char.to_uppercase().next().unwrap());
        } else {
            checksum.push(char);
        }
    }
    
    checksum
}

/**
 * 设置取消标志
 */
#[tauri::command]
fn cancel_generation() {
    if let Some(flag) = CANCEL_FLAG.get() {
        flag.store(true, Ordering::SeqCst);
    }
}

/**
 * 重置取消标志
 */
fn reset_cancel_flag() {
    if let Some(flag) = CANCEL_FLAG.get() {
        flag.store(false, Ordering::SeqCst);
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 进度统计信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressStats {
    /// 尝试次数
    pub attempts: u64,
    /// 匹配次数
    pub matches: u64,
    /// 耗时（毫秒）
    pub duration: u64,
}

/**
 * 将钱包信息保存到文件
 * 
 * @param wallet - 钱包信息
 * @param pattern - 靓号模式
 * @param save_path - 保存路径（可选）
 */
fn save_wallet_to_file(wallet: &Wallet, pattern: &str, save_path: Option<String>) -> Result<(), String> {
    // 确定保存目录
    let base_dir = if let Some(path) = save_path {
        PathBuf::from(path)
    } else {
        // 默认使用 Documents 目录
        directories::UserDirs::new()
            .ok_or("无法获取用户目录")?
            .document_dir()
            .ok_or("无法获取 Documents 目录")?
            .to_path_buf()
    };
    
    // 创建 wallets 目录
    let wallets_dir = base_dir.join("FancyWallets");
    std::fs::create_dir_all(&wallets_dir)
        .map_err(|e| format!("无法创建钱包目录: {}", e))?;
    
    // 使用会话时间戳（在同一次运行中使用相同的文件名）
    let timestamp = get_session_timestamp();
    let filename = format!("wallet_{}_{}.csv", pattern.replace('*', ""), timestamp);
    let file_path = wallets_dir.join(&filename);
    
    // 检查文件是否存在，决定是否需要写入 CSV 标题
    let file_exists = file_path.exists();
    
    // 打开文件（追加模式）
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("无法打开文件: {}", e))?;
    
    // 如果文件不存在，写入 CSV 标题
    if !file_exists {
        writeln!(file, "address,private_key,pattern")
            .map_err(|e| format!("无法写入标题: {}", e))?;
    }
    
    // 写入钱包信息
    writeln!(
        file,
        "{},{},{}",
        wallet.address,
        wallet.private_key,
        pattern
    ).map_err(|e| format!("无法写入钱包信息: {}", e))?;
    
    Ok(())
}

/**
 * 生成靓号钱包（前后缀同时匹配）
 * 
 * @param app - 应用句柄
 * @param pattern - 靓号模式字符串
 * @param max_attempts - 最大尝试次数
 * @param save_path - 保存路径（可选，默认 Documents 目录）
 * @returns 钱包信息
 */
#[tauri::command]
async fn generate_fancy_wallet(
    app: AppHandle,
    pattern: String,
    _max_attempts: u64,  // 保留参数以保持兼容性，但不再使用
    save_path: Option<String>,
) -> Result<Wallet, String> {
    let start_time = std::time::Instant::now();
    
    // 重置取消标志
    reset_cancel_flag();
    let cancel_flag = get_cancel_flag();
    
    // 检测是否为通配符模式（以 * 开头和结尾）
    let (is_wildcard, search_pattern) = if pattern.starts_with('*') && pattern.ends_with('*') && pattern.len() > 2 {
        // 通配符模式，提取中间的字符串
        let search = pattern[1..pattern.len()-1].to_lowercase();
        (true, search)
    } else {
        // 普通模式（前后缀匹配）
        (false, pattern.to_lowercase())
    };
    
    let secp = Secp256k1::new();
    let mut rng = OsRng;
    let mut matches_count = 0u64;
    let mut last_match: Option<Wallet> = None;
    let mut attempt = 0u64;
    
    // 无限循环，除非被取消
    loop {
        // 检查是否被取消
        if cancel_flag.load(Ordering::SeqCst) {
            if let Some(wallet) = last_match {
                return Ok(wallet);
            } else {
                return Err("生成已取消，未找到匹配的钱包".to_string());
            }
        }
        
        attempt += 1;
        // 生成随机私钥
        let mut random_bytes = [0u8; 32];
        rng.fill(&mut random_bytes);
        
        let secret_key = match SecretKey::from_slice(&random_bytes) {
            Ok(key) => key,
            Err(_) => continue,
        };
        
        // 从私钥生成公钥
        let public_key = PublicKey::from_secret_key(&secp, &secret_key);
        
        // 生成以太坊地址
        let public_key_bytes = public_key.serialize_uncompressed();
        let public_key_hash = &public_key_bytes[1..]; // 去掉0x04前缀
        let mut hasher = Keccak256::new();
        hasher.update(public_key_hash);
        let hash = hasher.finalize();
        let address_lower = hex::encode(&hash[12..]); // 取最后20字节（小写）
        
        // 转换为checksum格式（严格区分大小写）
        let address_checksum = to_checksum_address(&address_lower);
        
        // 检查是否符合靓号条件
        let matches = if is_wildcard {
            // 通配符模式：根据模式类型进行匹配
            match search_pattern.as_str() {
                "aaaa" => {
                    // *aaaa* 模式：前4个字符都是同一个字符，后4个字符也都是同一个字符（区分大小写）
                    if address_checksum.len() >= 8 {
                        // 检查前4个字符是否相同
                        let prefix_chars: Vec<char> = address_checksum.chars().take(4).collect();
                        let is_prefix_same = prefix_chars.iter().all(|&c| c == prefix_chars[0]);
                        
                        // 检查后4个字符是否相同
                        let suffix_chars: Vec<char> = address_checksum.chars().rev().take(4).collect();
                        let is_suffix_same = suffix_chars.iter().all(|&c| c == suffix_chars[0]);
                        
                        is_prefix_same && is_suffix_same
                    } else {
                        false
                    }
                }
                "aabb" => {
                    // *aabb* 模式：前4个字符和后4个字符都是aabb模式（区分大小写）
                    if address_checksum.len() >= 8 {
                        let prefix = &address_checksum[..4];
                        let suffix_start = address_checksum.len() - 4;
                        let suffix = &address_checksum[suffix_start..];
                        
                        // 检查前缀是否为aabb模式（前两个相同，后两个相同）
                        let prefix_aabb = prefix.chars().nth(0) == prefix.chars().nth(1) && 
                                          prefix.chars().nth(2) == prefix.chars().nth(3) &&
                                          prefix.chars().nth(0) != prefix.chars().nth(2);
                        
                        // 检查后缀是否为aabb模式
                        let suffix_aabb = suffix.chars().nth(0) == suffix.chars().nth(1) && 
                                          suffix.chars().nth(2) == suffix.chars().nth(3) &&
                                          suffix.chars().nth(0) != suffix.chars().nth(2);
                        
                        prefix_aabb && suffix_aabb
                    } else {
                        false
                    }
                }
                "abab" => {
                    // *abab* 模式：前4个字符和后4个字符都是abab模式（区分大小写）
                    if address_checksum.len() >= 8 {
                        let prefix = &address_checksum[..4];
                        let suffix_start = address_checksum.len() - 4;
                        let suffix = &address_checksum[suffix_start..];
                        
                        // 检查前缀是否为abab模式（奇偶位重复）
                        let prefix_abab = prefix.chars().nth(0) == prefix.chars().nth(2) && 
                                          prefix.chars().nth(1) == prefix.chars().nth(3) &&
                                          prefix.chars().nth(0) != prefix.chars().nth(1);
                        
                        // 检查后缀是否为abab模式
                        let suffix_abab = suffix.chars().nth(0) == suffix.chars().nth(2) && 
                                          suffix.chars().nth(1) == suffix.chars().nth(3) &&
                                          suffix.chars().nth(0) != suffix.chars().nth(1);
                        
                        prefix_abab && suffix_abab
                    } else {
                        false
                    }
                }
                _ => {
                    // 其他通配符模式：前后缀都要包含该模式（区分大小写）
                    let pattern_checksum = to_checksum_address(&search_pattern);
                    address_checksum.starts_with(&pattern_checksum) && address_checksum.ends_with(&pattern_checksum)
                }
            }
        } else {
            // 普通模式：前后缀都需要匹配（同时匹配，区分大小写）
            let pattern_checksum = to_checksum_address(&search_pattern);
            address_checksum.starts_with(&pattern_checksum) && address_checksum.ends_with(&pattern_checksum)
        };
        
        // 如果匹配，增加匹配计数
        if matches {
            matches_count += 1;
            
            // 保存钱包信息到文件（同时保存 CSV 和 JSON）
            let wallet = Wallet {
                address: format!("0x{}", address_checksum), // 使用checksum格式，添加 0x 前缀
                private_key: hex::encode(secret_key.secret_bytes()),
                attempts: attempt,
                duration: start_time.elapsed().as_millis() as u64,
            };
            
            // 保存最后一次匹配的钱包
            last_match = Some(wallet.clone());
            
            // 不返回，继续生成更多匹配的钱包
            let _ = save_wallet_to_file(&wallet, &pattern, save_path.clone());
        }
        
        // 每1000次尝试或者匹配时发送进度更新
        if attempt % 1000 == 0 || matches {
            let duration = start_time.elapsed().as_millis() as u64;
            let _ = app.emit("generation-progress", ProgressStats {
                attempts: attempt,
                matches: matches_count,
                duration,
            });
        }
        
        // 继续循环，不立即返回
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, generate_fancy_wallet, cancel_generation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
