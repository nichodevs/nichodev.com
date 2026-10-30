async function checkPublic(origin="https://nichodev.com"){
  for(const path of ["/health","/comunidade/","/api/community/session"]){
    const response=await fetch(origin+path,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error("Falha no acesso público: "+path+" HTTP "+response.status);
    if(path==="/api/community/session"&&!(await response.json()).publicRelease)throw new Error("O backend público não está ativo.");
    if(path==="/comunidade/"&&(await response.text()).includes("<strong>HOMOLOGAÇÃO</strong>"))throw new Error("A origem pública está exibindo homologação.");
  }
  return {status:"PUBLIC_COMMUNITY_OK"};
}
if(require.main===module)checkPublic().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={checkPublic};
