// 博古 · 静态页 + 模型转发服务（无第三方依赖，Node 18+）
const http=require("http"), fs=require("fs"), path=require("path");
const PORT=process.env.PORT||80;
const KEY=process.env.DEEPSEEK_API_KEY||process.env.MODEL_API_KEY||"";
const BASE=(process.env.MODEL_BASE_URL||"https://api.deepseek.com").replace(/\/$/,"");
const MODEL=process.env.MODEL_NAME||"deepseek-chat";
const ACCESS=process.env.ACCESS_CODE||"";               // 可选：设了以后页面里要填口令
const RATE=parseInt(process.env.RATE_PER_MIN||"20",10);  // 每 IP 每分钟上限
const MAXTOK=parseInt(process.env.MAX_TOKENS||"700",10);
const INDEX=fs.readFileSync(path.join(__dirname,"index.html"));
// ---- 豆包语音（火山引擎）：识别 + 合成，都用同一个 API Key ----
const VOLC_KEY=process.env.VOLC_API_KEY||"";
const VOLC_UID=process.env.VOLC_APP_ID||"bogu";
const TTS_RES=process.env.TTS_RESOURCE_ID||"seed-tts-1.0";          // 新音色可改 seed-tts-2.0
const ASR_RES=process.env.ASR_RESOURCE_ID||"volc.bigasr.auc_turbo";
const DEFAULT_VOICE=process.env.TTS_DEFAULT_VOICE||"zh_male_yuanboxiaoshu_moon_bigtts";
// 三十三位的音色表（可用环境变量 VOICE_MAP 传 JSON 覆盖任意一位）
let VOICES={
  kongzi:"zh_male_dongfanghaoran_moon_bigtts", laozi:"zh_male_yuanboxiaoshu_moon_bigtts", zhuangzi:"zh_male_jingqiangkanye_moon_bigtts",
  wangyangming:"zh_male_shenyeboke_moon_bigtts", sushi:"zh_male_wennuanahu_moon_bigtts", zengguofan:"zh_male_yuanboxiaoshu_moon_bigtts",
  libai:"zh_male_yangguangqingnian_moon_bigtts", taoyuanming:"zh_male_wennuanahu_moon_bigtts", luxun:"zh_male_shenyeboke_moon_bigtts",
  siddhartha:"zh_male_wennuanahu_moon_bigtts", huineng:"zh_male_guozhoudege_moon_bigtts", hongyi:"zh_male_dongfanghaoran_moon_bigtts",
  zhugeliang:"zh_male_dongfanghaoran_moon_bigtts", fanli:"zh_male_yuanboxiaoshu_moon_bigtts",
  socrates:"zh_male_yuanboxiaoshu_moon_bigtts", aurelius:"zh_male_dongfanghaoran_moon_bigtts", nietzsche:"zh_male_aojiaobazong_moon_bigtts",
  tolstoy:"zh_male_yuanboxiaoshu_moon_bigtts", camus:"zh_male_shenyeboke_moon_bigtts",
  lvdongbin:"zh_male_yangguangqingnian_moon_bigtts", tieguaili:"zh_male_jingqiangkanye_moon_bigtts", hexiangu:"zh_female_linjianvhai_moon_bigtts",
  zhangguolao:"zh_male_yuanboxiaoshu_moon_bigtts", hanzhongli:"zh_male_beijingxiaoye_moon_bigtts", lancaihe:"zh_male_shaonianzixin_moon_bigtts",
  hanxiangzi:"zh_male_shaonianzixin_moon_bigtts", caoguojiu:"zh_male_dongfanghaoran_moon_bigtts",
  sunwukong:"zh_male_sunwukong_mars_bigtts", zhubajie:"zh_male_zhubajie_mars_bigtts", nezha:"zh_male_naiqimengwa_mars_bigtts",
  jigong:"zh_male_jingqiangkanye_moon_bigtts", mulan:"zh_female_gaolengyujie_moon_bigtts", tudigong:"zh_male_wennuanahu_moon_bigtts"
};
try{ if(process.env.VOICE_MAP) Object.assign(VOICES, JSON.parse(process.env.VOICE_MAP)); }catch(e){ console.error("VOICE_MAP 不是合法 JSON"); }
function uuid(){ return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==="x"?r:(r&3|8)).toString(16);}); }
const ASR_RES_STD=process.env.ASR_RESOURCE_ID_STD||"volc.bigasr.auc";   // 标准版（提交+查询）作为极速版未开通时的退路
function asrHeaders(res, reqid){ return {"Content-Type":"application/json","X-Api-Key":VOLC_KEY,"X-Api-Resource-Id":res,"X-Api-Request-Id":reqid,"X-Api-Sequence":"-1"}; }
function asrBody(b64wav){ return JSON.stringify({user:{uid:VOLC_UID},audio:{format:"wav",data:b64wav},request:{model_name:"bigmodel",enable_punc:true,enable_itn:true}}); }
function pickText(j){ return (j.result&&j.result.text)||(j.result&&j.result.utterances&&j.result.utterances.map(u=>u.text).join(""))||""; }
async function volcASRStandard(b64wav){
  const reqid=uuid();
  let r=await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit",{method:"POST",headers:asrHeaders(ASR_RES_STD_CUR||ASR_RES_STD,reqid),body:asrBody(b64wav)});
  let code=r.headers.get("x-api-status-code"); let t=await r.text();
  if(code!=="20000000") throw new Error("识别提交失败 "+code+" "+(r.headers.get("x-api-message")||"")+" "+t.slice(0,120));
  for(let i=0;i<40;i++){
    await new Promise(z=>setTimeout(z,400));
    r=await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/query",{method:"POST",headers:asrHeaders(ASR_RES_STD_CUR||ASR_RES_STD,reqid),body:"{}"});
    code=r.headers.get("x-api-status-code"); t=await r.text();
    if(code==="20000000"){ let j={}; try{ j=JSON.parse(t); }catch(e){} return pickText(j); }
    if(code!=="20000001" && code!=="20000002") throw new Error("识别查询失败 "+code+" "+(r.headers.get("x-api-message")||""));
  }
  throw new Error("识别超时");
}
// 依次尝试多个资源 ID（控制台不同版本叫法不同），哪个通了就记住哪个；也可用 ASR_RESOURCE_IDS 指定，逗号分隔
const ASR_CANDIDATES=(process.env.ASR_RESOURCE_IDS||[ASR_RES,"volc.seedasr.auc_turbo","volc.seedasr.auc","volc.bigasr.auc_turbo","volc.bigasr.auc"].join(",")).split(",").map(s=>s.trim()).filter(Boolean);
let ASR_ACTIVE=null;
async function volcASRWith(res, b64wav){
  if(/turbo/.test(res)) return await volcASRFlashRes(res,b64wav);
  return await volcASRStandardRes(res,b64wav);
}
async function volcASR(b64wav){
  if(ASR_ACTIVE){ return await volcASRWith(ASR_ACTIVE,b64wav); }
  let lastErr=null;
  for(const res of [...new Set(ASR_CANDIDATES)]){
    try{ const t=await volcASRWith(res,b64wav); ASR_ACTIVE=res; console.log("ASR 资源可用：",res); return t; }
    catch(e){ lastErr=e; if(!/45000030|not granted/.test(e.message)) throw e; console.log("ASR 资源未开通：",res); }
  }
  throw new Error("你的 Key 没有任何可用的录音识别资源，试过："+ASR_CANDIDATES.join(" / ")+"。请到火山控制台的该服务页查看 Resource ID，填到环境变量 ASR_RESOURCE_IDS。最后错误："+(lastErr&&lastErr.message));
}
async function volcASRStandardRes(res,b64wav){ const old=ASR_RES_STD_CUR; ASR_RES_STD_CUR=res; try{ return await volcASRStandard(b64wav); } finally{ ASR_RES_STD_CUR=old; } }
let ASR_RES_STD_CUR=null;
async function volcASRFlashRes(res,b64wav){ const old=ASR_RES_FLASH_CUR; ASR_RES_FLASH_CUR=res; try{ return await volcASRFlash(b64wav); } finally{ ASR_RES_FLASH_CUR=old; } }
let ASR_RES_FLASH_CUR=null;
async function volcASRFlash(b64wav){
  const r=await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",{method:"POST",
    headers:{"Content-Type":"application/json","X-Api-Key":VOLC_KEY,"X-Api-Resource-Id":ASR_RES_FLASH_CUR||ASR_RES,"X-Api-Request-Id":uuid(),"X-Api-Sequence":"-1"},
    body:JSON.stringify({user:{uid:VOLC_UID},audio:{format:"wav",data:b64wav},request:{model_name:"bigmodel",enable_punc:true,enable_itn:true}})});
  const code=r.headers.get("x-api-status-code"); const t=await r.text();
  let j={}; try{ j=JSON.parse(t); }catch(e){}
  if(code && code!=="20000000") throw new Error("识别失败 "+code+" "+(r.headers.get("x-api-message")||"")+" "+t.slice(0,120));
  const text=(j.result&&j.result.text)||(j.result&&j.result.utterances&&j.result.utterances.map(u=>u.text).join(""))||"";
  return text;
}
async function volcTTS(text, speaker){
  const r=await fetch("https://openspeech.bytedance.com/api/v3/tts/unidirectional",{method:"POST",
    headers:{"Content-Type":"application/json","X-Api-Key":VOLC_KEY,"X-Api-Resource-Id":TTS_RES,"X-Api-Request-Id":uuid()},
    body:JSON.stringify({user:{uid:VOLC_UID},req_params:{text,speaker,audio_params:{format:"mp3",sample_rate:24000}}})});
  const t=await r.text();
  if(!r.ok) throw new Error("合成失败 "+r.status+" "+t.slice(0,160));
  // 流式返回的是一行行 JSON，逐行取 data 拼成 mp3
  const chunks=[]; let err=null;
  for(const line of t.split(/\r?\n/)){ const s=line.trim(); if(!s) continue; try{ const j=JSON.parse(s); if(j.data) chunks.push(Buffer.from(j.data,"base64")); if(j.code && j.code!==0 && j.code!==20000000 && j.message) err=j.code+" "+j.message; }catch(e){} }
  if(!chunks.length) throw new Error("合成无音频返回 "+(err||t.slice(0,160)));
  return Buffer.concat(chunks);
}
const hits=new Map();
function limited(ip){ const now=Date.now(); const a=(hits.get(ip)||[]).filter(t=>now-t<60000); a.push(now); hits.set(ip,a); return a.length>RATE; }
function json(res,code,obj){ res.writeHead(code,{"Content-Type":"application/json; charset=utf-8"}); res.end(JSON.stringify(obj)); }
http.createServer((req,res)=>{
  const url=req.url.split("?")[0];
  if(req.method==="GET" && (url==="/"||url==="/index.html")){ res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}); return res.end(INDEX); }
  if(url==="/api/health") return json(res,200,{ok:!!KEY, model:MODEL, access:!!ACCESS, voice:!!VOLC_KEY, asr:ASR_ACTIVE});
  if(req.method==="POST" && (url==="/api/asr"||url==="/api/tts")){
    if(!VOLC_KEY) return json(res,500,{error:"服务器未配置语音 Key（环境变量 VOLC_API_KEY）"});
    if(ACCESS && (req.headers["x-access-code"]||"")!==ACCESS) return json(res,401,{error:"访问口令不正确"});
    const ip=(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
    if(limited(ip)) return json(res,429,{error:"请求太频繁，稍后再试"});
    let body=""; req.on("data",c=>{ body+=c; if(body.length>6_000_000) req.destroy(); });
    req.on("end",async()=>{
      let inb; try{ inb=JSON.parse(body); }catch(e){ return json(res,400,{error:"bad json"}); }
      try{
        if(url==="/api/asr"){ if(!inb.audio) return json(res,400,{error:"no audio"}); const text=await volcASR(inb.audio); return json(res,200,{text}); }
        const text=String(inb.text||"").slice(0,1200); if(!text) return json(res,400,{error:"no text"});
        const speaker=VOICES[inb.sage]||DEFAULT_VOICE;
        let mp3; try{ mp3=await volcTTS(text,speaker); }catch(e){ if(speaker!==DEFAULT_VOICE){ mp3=await volcTTS(text,DEFAULT_VOICE); } else throw e; }
        res.writeHead(200,{"Content-Type":"audio/mpeg","Cache-Control":"no-store"}); res.end(mp3);
      }catch(e){ json(res,502,{error:e.message}); }
    });
    return;
  }
  if(req.method==="POST" && url==="/api/chat/completions"){
    if(!KEY) return json(res,500,{error:"服务器未配置模型 Key（环境变量 DEEPSEEK_API_KEY）"});
    if(ACCESS && (req.headers["x-access-code"]||"")!==ACCESS) return json(res,401,{error:"访问口令不正确"});
    const ip=(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
    if(limited(ip)) return json(res,429,{error:"请求太频繁，稍后再试"});
    let body=""; req.on("data",c=>{ body+=c; if(body.length>200000) req.destroy(); });
    req.on("end",async()=>{
      let inb; try{ inb=JSON.parse(body); }catch(e){ return json(res,400,{error:"bad json"}); }
      if(!Array.isArray(inb.messages)) return json(res,400,{error:"no messages"});
      const payload={ model:MODEL, messages:inb.messages.slice(-12), temperature:Math.min(Math.max(+inb.temperature||0.8,0),1.2), max_tokens:Math.min(+inb.max_tokens||MAXTOK,MAXTOK) };
      try{
        const r=await fetch(BASE+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+KEY},body:JSON.stringify(payload)});
        const t=await r.text(); res.writeHead(r.status,{"Content-Type":"application/json; charset=utf-8"}); res.end(t);
      }catch(e){ json(res,502,{error:"上游模型请求失败："+e.message}); }
    });
    return;
  }
  res.writeHead(404); res.end("not found");
}).listen(PORT,()=>console.log("bogu listening on",PORT));
