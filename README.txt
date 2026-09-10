博古 · 微信云托管部署包

1. 上传本 zip 到「云托管 → 服务 → 部署发布 → 上传代码包」，端口填 80。
2. 在「服务设置 → 环境变量」里添加：
   DEEPSEEK_API_KEY = sk-你的Key          （必填）
   ACCESS_CODE      = 任意口令             （可选；设了以后页面「设置」里要填同样口令才能用）
   RATE_PER_MIN     = 20                   （可选；每个访客每分钟最多次数，默认 20）
   MODEL_NAME       = deepseek-chat        （可选）
   MODEL_BASE_URL   = https://api.deepseek.com （可选；换通义就填 https://dashscope.aliyuncs.com/compatible-mode/v1 并改 MODEL_NAME）
3. 部署成功后打开服务域名，页面自动检测到服务器已接入，无需再填 Key。
