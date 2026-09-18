博古 · 微信云托管部署包

1. 上传本 zip 到「云托管 → 服务 → 部署发布 → 上传代码包」，端口填 80。
2. 在「服务设置 → 环境变量」里添加：
   DEEPSEEK_API_KEY = sk-你的Key          （必填）
   ACCESS_CODE      = 任意口令             （可选；设了以后页面「设置」里要填同样口令才能用）
   RATE_PER_MIN     = 20                   （可选；每个访客每分钟最多次数，默认 20）
   MODEL_NAME       = deepseek-chat        （可选）
   MODEL_BASE_URL   = https://api.deepseek.com （可选；换通义就填 https://dashscope.aliyuncs.com/compatible-mode/v1 并改 MODEL_NAME）
   —— 语音（豆包语音 / 火山引擎，新版控制台一个 API Key 同时管识别与合成）——
   VOLC_API_KEY     = 火山引擎语音的 API Key      （必填，否则语音功能不可用，页面自动退回文字）
   VOLC_APP_ID      = 你的 App ID                 （可选，用作 uid）
   TTS_RESOURCE_ID  = seed-tts-1.0                （可选；默认 1.0 音色库，想用 2.0 新音色改为 seed-tts-2.0）
   ASR_RESOURCE_ID  = volc.bigasr.auc_turbo       （可选，默认即极速识别）
   TTS_DEFAULT_VOICE= zh_male_yuanboxiaoshu_moon_bigtts （可选，某位音色不可用时的兜底）
   VOICE_MAP        = {"sunwukong":"xxx","laozi":"yyy"}  （可选，JSON，覆盖任意一位的音色）
3. 部署成功后打开服务域名，页面自动检测到服务器已接入，无需再填 Key。
