export default {
  async fetch(request) {
    const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:C});
    const url=new URL(request.url);

    // Health check
    if(url.pathname==='/health')return R({ok:true,ts:Date.now()});

    // GitHub proxy - download source code
    if(url.pathname==='/github'){
      const t=request.headers.get('X-GitHub-Url');
      if(!t)return R({error:'Missing X-GitHub-Url'},400);
      try{
        const r=await fetch(t);
        return new Response(await r.text(),{status:r.status,headers:{'Content-Type':'text/plain','Access-Control-Allow-Origin':'*'}});
      }catch(e){return R({error:e.message},502)}
    }

    // Cloudflare API proxy
    if(url.pathname==='/cf'){
      const auth=request.headers.get('Authorization');
      if(!auth)return R({error:'Missing Authorization'},401);
      const path=request.headers.get('X-CF-Path');
      if(!path)return R({error:'Missing X-CF-Path'},400);
      const method=request.headers.get('X-CF-Method')||'GET';
      try{
        const opts={method,headers:{Authorization:auth}};
        if(method!=='GET'&&method!=='HEAD'){
          const ct=request.headers.get('Content-Type')||'';
          if(ct.includes('multipart/form-data')){opts.body=await request.formData()}
          else{opts.body=await request.text();opts.headers['Content-Type']='application/json'}
        }
        const r=await fetch('https://api.cloudflare.com/client/v4'+path,opts);
        return new Response(await r.text(),{status:r.status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
      }catch(e){return R({error:e.message},502)}
    }

    // Deploy endpoint - handles everything
    if(url.pathname==='/deploy' && request.method==='POST'){
      try{
        const body=await request.json();
        const {token,accountId,panelType}=body;
        // Generate random name to avoid Cloudflare detection
        const rnd=Math.random().toString(36).slice(2,8)+Math.floor(Math.random()*1000);
        const workerName=`srv-${rnd}`;
        const logs=[];
        const log=(msg)=>logs.push(`<span style="color:#00d4aa">▸</span> ${msg}`);
        const err=(msg)=>logs.push(`<span style="color:#ff4757">✖</span> ${msg}`);

        log('شروع استقرار...');
        const h={'Authorization':'Bearer '+token};

        // Validate token
        log('اعتبارسنجی توکن...');
        const vr=await cfDirect(h,'/user/tokens/verify');
        if(!vr.success)return R({success:false,logs,error:'توکن نامعتبر: '+(vr.errors?.[0]?.message||'unknown')});

        // Get accounts
        log('دریافت اطلاعات حساب...');
        const ar=await cfDirect(h,'/accounts');
        if(!ar.success||!ar.result.length)return R({success:false,logs,error:'حسابی یافت نشد'});
        const acc=accountId?ar.result.find(a=>a.id===accountId):ar.result[0];
        if(!acc)return R({success:false,logs,error:'حساب یافت نشد'});
        const aid=acc.id;
        log(`حساب: ${acc.name||aid}`);

        // Validate-only mode (skip deploy)
        if(panelType==='validate'){
          return R({success:true,logs,accountName:acc.name,accountId:aid});
        }

        // Download source
        log('دانلود کد منبع...');
        const panels={
          nahan:{repo:'itsyebekhe/nahan',file:'_worker.js',bindings:{d1:['IOT_DB'],kv:[]},vars:{},path:'/sync/dash'},
          edge:{repo:'cmliu/edgetunnel',file:'_worker.js',bindings:{d1:[],kv:['KV']},vars:{ADMIN:'admin'},path:'/admin'},
          cfnew:{repo:'byjoey/cfnew',file:'明文源吗',bindings:{d1:[],kv:['C']},vars:{u:crypto.randomUUID()},path:''},
          nova:{repo:'IRNova/Nova-Proxy',file:'worker.js',bindings:{d1:['DB'],kv:['KV']},vars:{ADMIN:'admin'},path:'/admin'}
        };
        const p=panels[panelType];
        if(!p)return R({success:false,logs,error:'پنل نامعتبر'});

        const code=await dlCode(p.repo,p.file);
        if(!code)return R({success:false,logs,error:'کد منبع یافت نشد'});
        log(`کد دانلود شد: ${(code.length/1024).toFixed(0)}KB`);

        // Create bindings
        const bindings=[];
        for(const name of(p.bindings.d1||[])){
          log(`ساخت D1: ${name}...`);
          const r=await cfDirect(h,`/accounts/${aid}/d1/database`,'POST',{name:`d1-${rnd}`});
          if(r.success){bindings.push({name,type:'d1',id:r.result.uuid});log(`D1 OK: ${r.result.uuid.slice(0,8)}...`)}
          else{err(`D1 خطا: ${r.errors?.[0]?.message||'unknown'}`)}
        }
        for(const name of(p.bindings.kv||[])){
          log(`ساخت KV: ${name}...`);
          const lr=await cfDirect(h,`/accounts/${aid}/storage/kv/namespaces`);
          let id=lr.result?.find(x=>x.title===`kv-${rnd}`)?.id;
          if(!id){
            const r=await cfDirect(h,`/accounts/${aid}/storage/kv/namespaces`,'POST',{title:`kv-${rnd}`});
            id=r.result?.id;
          }
          if(id){bindings.push({name,type:'kv_namespace',namespace_id:id});log(`KV OK: ${id.slice(0,8)}...`)}
          else{err(`KV خطا`)}
        }

        // Deploy worker
        log('استقرار Worker...');
        const vars=p.vars||{};
        const bindingsWithVars=[...bindings];
        if(Object.keys(vars).length){
          for(const [k,v] of Object.entries(vars)){
            log(`تنظیم متغیر: ${k}...`);
            bindingsWithVars.push({name:k,type:'secret_text',text:v});
          }
        }
        const md={main_module:'worker.js',compatibility_date:'2024-09-22',compatibility_flags:['nodejs_compat'],bindings:bindingsWithVars};
        const form=new FormData();
        form.append('metadata',new Blob([JSON.stringify(md)],{type:'application/json'}));
        form.append('worker.js',new Blob([code],{type:'application/javascript+module'}),'worker.js');
        const dr=await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/scripts/${workerName}`,{method:'PUT',headers:{Authorization:'Bearer '+token},body:form});
        const dd=await dr.json();
        if(!dd.success)return R({success:false,logs,error:'خطای استقرار: '+(dd.errors?.[0]?.message||'unknown')});
        log('Worker مستقر شد ✅');

        // Enable workers.dev
        log('فعال‌سازی workers.dev...');
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/services/${workerName}/environments/production/subdomain`,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
        const sr=await cfDirect(h,`/accounts/${aid}/workers/subdomain`);
        const sub=sr.result?.subdomain||'workers.dev';
        const basePath=`https://${workerName}.${sub}${sub.includes('.')?'':'.workers.dev'}`;
        const panelPath=p.path||(vars.u?`/${vars.u}`:'');
        const panelURL=basePath+panelPath;
        log(`آدرس: ${panelURL}`);

        return R({success:true,logs,panelURL,workerName,panelType,uuid:vars.u||null,panelPath});
      }catch(e){return R({success:false,logs:[`خطا: ${e.message}`],error:e.message})}
    }

    return R({error:'Not found',path:url.pathname},404);
  }
};

function R(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}})}

async function cfDirect(h,path,method='GET',body=null){
  try{
    const opts={method,headers:{...h,'Content-Type':'application/json'}};
    if(body)opts.body=JSON.stringify(body);
    const r=await fetch('https://api.cloudflare.com/client/v4'+path,opts);
    return await r.json();
  }catch(e){return{success:false,errors:[{message:e.message}]}}
}

async function dlCode(repo,file){
  const f=encodeURIComponent(file);
  const urls=[
    `https://cdn.jsdelivr.net/gh/${repo}@main/${f}`,
    `https://cdn.jsdelivr.net/gh/${repo}@master/${f}`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/main/${f}`
  ];
  for(const u of urls){
    try{const r=await fetch(u);if(r.ok){const t=await r.text();if(t.length>200)return t}}catch(e){}
  }
  return null;
}
