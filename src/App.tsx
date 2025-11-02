import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import "./App.css";

/**
 * 格式化数字为自适应单位（K, M, B等）
 * @param num - 要格式化的数字
 * @returns 格式化后的字符串
 */
function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    return (num / 1000).toFixed(1) + 'K';
  } else if (num < 1000000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else {
    return (num / 1000000000).toFixed(1) + 'B';
  }
}

/**
 * 格式化时长为自适应单位（ms, s, min, h等）
 * @param ms - 毫秒数
 * @returns 格式化后的字符串
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return ms.toFixed(0) + ' ms';
  } else if (ms < 60000) {
    return (ms / 1000).toFixed(1) + ' s';
  } else if (ms < 3600000) {
    return (ms / 60000).toFixed(1) + ' min';
  } else {
    return (ms / 3600000).toFixed(1) + ' h';
  }
}

/**
 * 靓号钱包生成器
 */
function App() {
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // 取消标志
  const cancelRef = useRef(false);
  
  // 进度统计
  const [progress, setProgress] = useState({
    attempts: 0,
    matches: 0,
    duration: 0,
  });
  
  // 靓号配置（固定为前后缀匹配）
  const [pattern, setPattern] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<string>("");
  const [savePath, setSavePath] = useState<string>("");
  const [language, setLanguage] = useState("zh-CN");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 推荐的靓号模式
  const recommendedPatterns = [
    { label: t("recommendedPatterns.aaaa"), value: "*aaaa*" },
    { label: t("recommendedPatterns.aabb"), value: "*aabb*" },
    { label: t("recommendedPatterns.abab"), value: "*abab*" },
  ];

  // 语言列表
  const languages = [
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "en", name: "English" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "es", name: "Español" },
    { code: "it", name: "Italiano" },
    { code: "ru", name: "Русский" },
    { code: "ar", name: "العربية" },
    { code: "pt", name: "Português" },
    { code: "nl", name: "Nederlands" },
    { code: "tr", name: "Türkçe" },
    { code: "hi", name: "हिन्दी" },
    { code: "sv", name: "Svenska" },
  ];

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    setIsDropdownOpen(false);
  };

  /**
   * 处理点击外部关闭下拉框
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * 监听进度事件
   */
  useEffect(() => {
    let unlisten: any;
    
    (async () => {
      unlisten = await listen("generation-progress", (event: any) => {
        setProgress(event.payload);
      });
    })();
    
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  /**
   * 停止生成
   */
  async function stopGenerating() {
    cancelRef.current = true;
    // 调用后端取消命令
    await invoke("cancel_generation").catch(err => {
      console.error("取消生成失败:", err);
    });
    setIsGenerating(false);
  }

  /**
   * 开始生成靓号钱包
   */
  async function startGenerating() {
    cancelRef.current = false;
    setIsGenerating(true);
    setResult(null);
    setProgress({ attempts: 0, matches: 0, duration: 0 });
    
    try {
      const wallet = await invoke("generate_fancy_wallet", {
        pattern,
        maxAttempts: 100000,  // 保留参数以保持兼容性，但后端不再使用此限制
        savePath: savePath || null,
      });
      
      if (!cancelRef.current) {
        setResult(wallet);
      }
    } catch (error) {
      if (!cancelRef.current) {
        console.error("生成钱包失败:", error);
        setResult({ error: String(error) });
      }
    } finally {
      setIsGenerating(false);
      cancelRef.current = false;
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-950 py-8 px-4">

      <div className="max-w-2xl mx-auto relative z-10">
        {/* 语言选择器 */}
        <div className="flex justify-end mb-4">
          <div className="relative" ref={dropdownRef}>
            {/* 下拉框按钮 */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-3 py-2 bg-[#110f11] border border-purple-600/30 text-purple-300 rounded-lg text-sm focus:outline-none focus:border-purple-500 hover:border-purple-500 transition-colors flex items-center gap-2 min-w-[120px] justify-between"
            >
              <span>{languages.find(l => l.code === language)?.name}</span>
              <svg 
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* 下拉选项列表 */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 max-h-80 overflow-y-auto bg-[#110f1120] border border-purple-600/30 rounded-lg shadow-lg z-50 backdrop-blur-sm">
                <div className="py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full px-4 py-2 text-sm text-left text-purple-300 hover:bg-purple-600/20 transition-colors ${
                        language === lang.code ? 'bg-purple-600/30 font-semibold' : ''
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 头部标题 */}
        <div className="text-center mb-12">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent mb-3 animate-pulse">
            {t("title")}
          </h1>
        </div>

        {/* 配置区域 */}
        <div className={`rotating-border ${isGenerating ? 'spinning' : ''} rounded-2xl mb-8 shadow-2xl backdrop-blur-sm p-8`}>
          <div className="relative z-10">
            {/* 靓号模式输入 */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-purple-300 mb-2">
                {t("patternLabel")}
              </label>
              
              {/* 推荐选项 */}
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {recommendedPatterns.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setPattern(item.value);
                        setSelectedPattern(item.value);
                        if (showCustomInput) {
                          setShowCustomInput(false);
                        }
                      }}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        selectedPattern === item.value && !showCustomInput
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                          : "bg-[#22222288] border border-purple-600/30 text-purple-300 hover:border-purple-500"
                      } disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px]`}
                    >
                      {item.label}
                    </button>
                  ))}
                  
                  {/* 自选号码按钮 */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomInput(!showCustomInput);
                      if (!showCustomInput) {
                        setSelectedPattern("");
                        setPattern("");
                      }
                    }}
                    disabled={isGenerating}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      showCustomInput
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                        : "bg-[#22222288] border border-purple-600/30 text-purple-300 hover:border-purple-500"
                    } disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px]`}
                  >
                    {t("customNumber")}
                  </button>
                </div>
              </div>

              {/* 自定义输入 - 仅在选择"自选号码"时显示 */}
              {showCustomInput && (
                <div className="mt-3">
                  <input
                    id="pattern"
                    type="text"
                    value={pattern}
                    onChange={(e) => {
                      setPattern(e.target.value);
                    }}
                    placeholder={`${t("customPattern")} (${t("patternDescription")})`}
                    disabled={isGenerating}
                    maxLength={10}
                    autoFocus
                    className="w-full px-4 py-3 bg-[#22222288] border-2 border-purple-600/30 text-white rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
                  />
                </div>
              )}
            </div>

            {/* 保存路径配置 */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-purple-300 mb-2">
                {t("savePath")}
              </label>
              <input
                id="save-path"
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder={t("savePathPlaceholder")}
                disabled={isGenerating}
                className="w-full px-4 py-3 bg-[#22222288] border-2 border-purple-600/30 text-white rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
              />
            </div>

            {/* 生成按钮 */}
            <button
              onClick={isGenerating ? stopGenerating : startGenerating}
              disabled={!pattern}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg rounded-lg focus:outline-none focus:ring-4 focus:ring-purple-500/50 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none animate-pulse-subtle cursor-pointer"
            >
              {isGenerating ? t("stop") : t("generate")}
            </button>
          </div>
        </div>

        {/* 生成中显示实时统计 */}
        {isGenerating && (
          <div className="bg-[#110f11] rounded-2xl shadow-2xl p-8 border border-purple-500/30 backdrop-blur-sm">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 text-center">
              {t("generating")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg text-center">
                <span className="text-sm font-semibold text-purple-300 block mb-2">{t("attempts")}</span>
                <span className="text-white font-mono text-2xl">{formatNumber(progress.attempts)}</span>
              </div>
              <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg text-center">
                <span className="text-sm font-semibold text-purple-300 block mb-2">{t("matches")}</span>
                <span className="text-pink-400 font-mono text-2xl">{formatNumber(progress.matches)}</span>
              </div>
              <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg text-center">
                <span className="text-sm font-semibold text-purple-300 block mb-2">{t("duration")}</span>
                <span className="text-white font-mono text-2xl">{formatDuration(progress.duration)}</span>
              </div>
              <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg text-center">
                <span className="text-sm font-semibold text-purple-300 block mb-2">{t("averageDuration")}</span>
                <span className="text-fuchsia-400 font-mono text-2xl">
                  {progress.attempts > 0 
                    ? Math.round(progress.duration / progress.attempts * 1000) + ' ms'
                    : '0 ms'
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 结果显示区域 */}
        {result && !isGenerating && (
          <div className="bg-[#110f11] rounded-2xl shadow-2xl p-8 border border-purple-500/30 backdrop-blur-sm">
            {result.error ? (
              <div className="bg-red-900/30 border-l-4 border-red-500 text-red-300 p-4 rounded">
                {result.error}
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 text-center">
                  {t("success")}
                </h3>
                <div className="space-y-4">
                  {/* 地址 */}
                  <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg">
                    <span className="text-sm font-semibold text-purple-300 block mb-2">{t("address")}</span>
                    <span className="text-purple-400 font-mono break-all text-sm">
                      {result.address}
                    </span>
                  </div>

                  {/* 私钥 */}
                  <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg">
                    <span className="text-sm font-semibold text-purple-300 block mb-2">{t("privateKey")}</span>
                    <span className="text-pink-400 font-mono break-all text-sm">
                      {result.private_key}
                    </span>
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg">
                      <span className="text-sm font-semibold text-purple-300 block mb-2">{t("attempts")}</span>
                      <span className="text-white font-mono text-lg">{formatNumber(result.attempts)}</span>
                    </div>
                    <div className="bg-[#22222288] border border-purple-600/30 p-4 rounded-lg">
                      <span className="text-sm font-semibold text-purple-300 block mb-2">{t("duration")}</span>
                      <span className="text-white font-mono text-lg">{formatDuration(result.duration)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
