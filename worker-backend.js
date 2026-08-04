export default {
  async fetch(request) {
    // Allowed origins for CORS
    const ALLOWED=['arshiyashams675-sudo.github.io','idvdjd8388.github.io','localhost','127.0.0.1'];
    const origin=request.headers.get('Origin')||request.headers.get('Referer')||'';
    const isAllowed=ALLOWED.some(o=>origin.includes(o));
    const corsHeaders={'Access-Control-Allow-Origin':isAllowed?origin:'','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});

    const url=new URL(request.url);

    // Health check (no auth needed)
    if(url.pathname==='/health')return R({ok:true,ts:Date.now()},200,corsHeaders);

    // Security: origin check for all other endpoints
    if(!isAllowed)return R({error:'Unauthorized'},403,corsHeaders);

    // GitHub proxy - download source code (whitelisted hosts only)
    if(url.pathname==='/github'){
      const t=request.headers.get('X-GitHub-Url');
      if(!t)return R({error:'Missing X-GitHub-Url'},400,corsHeaders);
      try{
        const u=new URL(t);
        const allowedHosts=['github.com','raw.githubusercontent.com','cdn.jsdelivr.net','githack.com','objects.githubusercontent.com'];
        if(!allowedHosts.includes(u.hostname))return R({error:'Host not allowed: '+u.hostname},403,corsHeaders);
        const r=await fetch(t);
        return new Response(await r.text(),{status:r.status,headers:{'Content-Type':'text/plain','Access-Control-Allow-Origin':origin}});
      }catch(e){return R({error:e.message},502,corsHeaders)}
    }

    // Cloudflare API proxy (whitelisted paths only)
    if(url.pathname==='/cf'){
      const auth=request.headers.get('Authorization');
      if(!auth)return R({error:'Missing Authorization'},401,corsHeaders);
      const path=request.headers.get('X-CF-Path');
      if(!path)return R({error:'Missing X-CF-Path'},400,corsHeaders);
      // Whitelist CF API paths
      const allowedPaths=['/user/tokens/verify','/accounts','/user'];
      const pathAllowed=allowedPaths.some(p=>path===p||path.startsWith('/accounts/'));
      if(!pathAllowed)return R({error:'Path not allowed: '+path},403,corsHeaders);
      const method=request.headers.get('X-CF-Method')||'GET';
      try{
        const opts={method,headers:{Authorization:auth}};
        if(method!=='GET'&&method!=='HEAD'){
          const ct=request.headers.get('Content-Type')||'';
          if(ct.includes('multipart/form-data')){opts.body=await request.formData()}
          else{opts.body=await request.text();opts.headers['Content-Type']='application/json'}
        }
        const r=await fetch('https://api.cloudflare.com/client/v4'+path,opts);
        return new Response(await r.text(),{status:r.status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin}});
      }catch(e){return R({error:e.message},502,corsHeaders)}
    }

    // Deploy endpoint - handles everything
    if(url.pathname==='/deploy' && request.method==='POST'){
      try{
        const body=await request.json();
        const {token,accountId,panelType}=body;
        // Validate token format
        if(!token||!token.startsWith('cfut_'))return R({success:false,error:'فرمت توکن نامعتبر است. توکن باید با cfut_ شروع شود'},400,corsHeaders);
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
        if(!vr.success)return R({success:false,logs,error:'توکن نامعتبر: '+(vr.errors?.[0]?.message||'unknown')},200,corsHeaders);

        // Get accounts
        log('دریافت اطلاعات حساب...');
        const ar=await cfDirect(h,'/accounts');
        if(!ar.success||!ar.result.length)return R({success:false,logs,error:'حسابی یافت نشد'},200,corsHeaders);
        const acc=accountId?ar.result.find(a=>a.id===accountId):ar.result[0];
        if(!acc)return R({success:false,logs,error:'حساب یافت نشد'},200,corsHeaders);
        const aid=acc.id;
        log(`حساب: ${acc.name||aid}`);

        // Validate-only mode (skip deploy)
        if(panelType==='validate'){
          return R({success:true,logs,accountName:acc.name,accountId:aid},200,corsHeaders);
        }

        // Download source
        log('دانلود کد منبع...');
        const panels={
          nahan:{repo:'itsyebekhe/nahan',file:'_worker.js',bindings:{d1:['IOT_DB'],kv:[]},vars:{},path:'/sync/dash'},
          edge:{repo:'cmliu/edgetunnel',file:'_worker.js',bindings:{d1:[],kv:['KV']},vars:{ADMIN:'admin'},path:'/admin'},
          cfnew:{repo:'byjoey/cfnew',file:'明文源吗',bindings:{d1:[],kv:['C']},vars:{u:crypto.randomUUID()},path:''},
          nova:{repo:'IRNova/Nova-Proxy',file:'worker.js',bindings:{d1:['DB'],kv:['KV']},vars:{ADMIN:'admin'},path:'/admin'},
          edgtun:{repo:'6Kmfi6HP/EDtunnel',file:'_worker.js',bindings:{d1:[],kv:[]},vars:{UUID:crypto.randomUUID()},path:''},
          fox:{repo:'code3-dev/foxcloud',file:'worker.js',release:'v1.0.0',bindings:{d1:[],kv:[]},vars:{UUID:crypto.randomUUID(),PROXY_IP:'172.66.45.9:443'},path:'/sub'},
          amcf:{repo:'amclubs/am-cf-tunnel',file:'_worker.js',bindings:{d1:[],kv:['amclubs']},vars:{UUID:crypto.randomUUID()},path:'/'},
          vtpanel:{repo:'bayueqi/ZQ-VTPanel',file:'_worker.js',bindings:{d1:[],kv:['VTPanel']},vars:{},path:'/'},
        };
        const vtpanelUUID=crypto.randomUUID();
        const p=panels[panelType];
        if(!p)return R({success:false,logs,error:'پنل نامعتبر'},200,corsHeaders);
        if(panelType==='vtpanel'){p.vars={};log(`UUID ساخته شد: ${vtpanelUUID}`)}

        const code=await dlCode(p.repo,p.file,p.release);
        if(!code)return R({success:false,logs,error:'کد منبع یافت نشد'},200,corsHeaders);
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
        // Build multipart body manually to avoid CF Worker runtime FormData Content-Type issues
        const boundary='----CFBoundary'+Math.random().toString(36).slice(2);
        const CRLF='\r\n';
        const mdJson=JSON.stringify(md);
        const parts=[
          '--'+boundary+CRLF+'Content-Disposition: form-data; name="metadata"'+CRLF+'Content-Type: application/json'+CRLF+CRLF+mdJson,
          '--'+boundary+CRLF+'Content-Disposition: form-data; name="worker.js"; filename="worker.js"'+CRLF+'Content-Type: application/javascript+module'+CRLF+CRLF+code,
          '--'+boundary+'--'
        ].join(CRLF);
        const dr=await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/scripts/${workerName}`,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary},body:parts});
        const dd=await dr.json();
        if(!dd.success)return R({success:false,logs,error:'خطای استقرار: '+(dd.errors?.[0]?.message||'unknown')},200,corsHeaders);
        log('Worker مستقر شد ✅');

        // Enable workers.dev
        log('فعال‌سازی workers.dev...');
        const enableR=await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/services/${workerName}/environments/production/subdomain`,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
        const enableData=await enableR.json().catch(()=>({}));

        // Wait for workers.dev propagation
        log('صبر برای فعال‌سازی workers.dev...');
        await new Promise(r=>setTimeout(r,5000));

        // === Subdomain detection (multi-strategy) ===
        let sub='';

        // Strategy 1: Account settings API
        const acctR=await cfDirect(h,`/accounts/${aid}`);
        sub=acctR.result?.settings?.subdomain;

        // Strategy 2: Workers subdomain API
        if(!sub||sub==='workers.dev'){
          const sr=await cfDirect(h,`/accounts/${aid}/workers/subdomain`);
          sub=sr.result?.subdomain;
        }

        // Strategy 3: Enable response itself
        if(!sub||sub==='workers.dev'){
          sub=enableData?.result?.subdomain||'';
        }

        // Strategy 4: Service environment endpoint (full deployment info)
        if(!sub||sub==='workers.dev'){
          try{
            const envR=await cfDirect(h,`/accounts/${aid}/workers/services/${workerName}/environments/production`);
            sub=envR.result?.subdomain||envR.result?.service?.subdomain||'';
          }catch(e){}
        }

        // Strategy 5: /user endpoint (token owner info may include subdomain)
        if(!sub||sub==='workers.dev'){
          try{
            const userR=await cfDirect(h,'/user');
            sub=userR.result?.subdomain||userR.result?.organizations?.[0]?.subdomain||'';
          }catch(e){}
        }

        // Strategy 6: Workers services list
        if(!sub||sub==='workers.dev'){
          try{
            const svcR=await cfDirect(h,`/accounts/${aid}/workers/services`);
            if(svcR.success&&svcR.result?.length){
              for(const svc of svcR.result){
                if(svc.service?.subdomain){sub=svc.service.subdomain;break}
                if(svc.subdomain){sub=svc.subdomain;break}
              }
            }
          }catch(e){}
        }

        // Strategy 7: Fetch-based — check redirect headers from actual worker URL
        if(!sub||sub==='workers.dev'){
          log('تشخیص سوب‌دامین از طریق URL...');
          try{
            const checkR=await fetch(`https://${workerName}.workers.dev`,{redirect:'manual'});
            const loc=checkR.headers.get('Location')||'';
            if(loc){
              const m=loc.match(/\/\/[^.]+\.([a-z0-9]+)\.workers\.dev/i);
              if(m&&m[1]!=='workers')sub=m[1];
            }
          }catch(e){}
        }

        // Strategy 8: Try account name as subdomain (verify by fetching)
        if(!sub||sub==='workers.dev'){
          const acctName=(acc.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
          if(acctName&&acctName.length>1&&acctName!=='workers'){
            try{
              const testR=await fetch(`https://${workerName}.${acctName}.workers.dev`);
              if(testR.ok||testR.status===302){
                sub=acctName;
                log(`سوب‌دامین از نام حساب تشخیص داده شد: ${sub}`);
              }
            }catch(e){}
          }
        }

        // Final: determine basePath and verify it actually works
        if(!sub||sub==='workers.dev'){
          sub='workers.dev';
          log('سوب‌دامین از API قابل تشخیص نبود، URL پیش‌فرض استفاده شد');
        }
        const basePath=`https://${workerName}.${sub}${sub.includes('.')?'':'.workers.dev'}`;
        const panelPath=p.path||(vars.u?`/${vars.u}`:'');
        const panelURL=basePath+panelPath;

        // Verify the URL actually works (if not, try without subdomain)
        try{
          const verifyR=await fetch(panelURL,{redirect:'follow'});
          if(!verifyR.ok&&verifyR.status!==302){
            // Subdomain URL doesn't work, try direct workers.dev
            const directURL=`https://${workerName}.workers.dev${panelPath}`;
            const directR=await fetch(directURL,{redirect:'follow'});
            if(directR.ok||directR.status===302){
              log(`آدرس سوب‌دامین کار نمیکرد، URL مستقیم استفاده شد`);
              return R({success:true,logs,panelURL:directURL,workerName,panelType,uuid:vars.u||vars.UUID||vars.ID||vtpUUID||null,panelPath},200,corsHeaders);
            }
          }
        }catch(e){}

        log(`آدرس: ${panelURL}`);

        // For VTPanel: write UUID to KV
        let vtpUUID=null;
        if(panelType==='vtpanel'){
          vtpUUID=vtpanelUUID;
          const kvBinding=bindings.find(b=>b.name==='VTPanel');
          if(kvBinding){
            const kvId=kvBinding.namespace_id;
            log('ذخیره UUID در KV...');
            const writeR=await cfDirect(h,`/accounts/${aid}/storage/kv/namespaces/${kvId}/values/user_config`,'PUT',{uuid:vtpUUID});
            if(writeR.success){log(`UUID ذخیره شد: ${vtpUUID}`)}
            else{log('UUID ذخیره نشد - کاربر باید دستی وارد کند')}
          }
        }

        return R({success:true,logs,panelURL,workerName,panelType,uuid:vars.u||vars.UUID||vars.ID||vtpUUID||null,panelPath},200,corsHeaders);
      }catch(e){return R({success:false,logs:[`خطا: ${e.message}`],error:e.message},200,corsHeaders)}
    }

    return R({error:'Not found',path:url.pathname},404,corsHeaders);
  }
};

function R(d,s=200,cors={}){return new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':cors['Access-Control-Allow-Origin']||'',...cors}})}

async function cfDirect(h,path,method='GET',body=null){
  try{
    const opts={method,headers:{...h,'Content-Type':'application/json'}};
    if(body)opts.body=JSON.stringify(body);
    const r=await fetch('https://api.cloudflare.com/client/v4'+path,opts);
    return await r.json();
  }catch(e){return{success:false,errors:[{message:e.message}]}}
}

async function dlCode(repo,file,release){
  const f=encodeURIComponent(file);
  if(release){
    const rUrl=`https://github.com/${repo}/releases/download/${release}/${f}`;
    try{const r=await fetch(rUrl);if(r.ok){const t=await r.text();if(t.length>200)return t}}catch(e){}
  }
  const urls=[
    `https://cdn.jsdelivr.net/gh/${repo}@main/${f}`,
    `https://cdn.jsdelivr.net/gh/${repo}@master/${f}`,
    `https://githack.com/${repo}/raw/refs/heads/main/${f}`,
    `https://githack.com/${repo}/raw/refs/heads/master/${f}`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/main/${f}`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/master/${f}`
  ];
  for(const u of urls){
    try{const r=await fetch(u);if(r.ok){const t=await r.text();if(t.length>200)return t}}catch(e){}
  }
  return null;
}
