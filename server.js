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
const hits=new Map();
function limited(ip){ const now=Date.now(); const a=(hits.get(ip)||[]).filter(t=>now-t<60000); a.push(now); hits.set(ip,a); return a.length>RATE; }
function json(res,code,obj){ res.writeHead(code,{"Content-Type":"application/json; charset=utf-8"}); res.end(JSON.stringify(obj)); }
http.createServer((req,res)=>{
  const url=req.url.split("?")[0];
  if(req.method==="GET" && (url==="/"||url==="/index.html")){ res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}); return res.end(INDEX); }
  if(url==="/api/health") return json(res,200,{ok:!!KEY, model:MODEL, access:!!ACCESS});
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
