const path=require("node:path");
const {createCommunityApp}=require("./app");

function start({publicRelease=false}={}){
  const release=publicRelease?require("./production-config").productionConfig():null;
  const production=process.env.NODE_ENV==="production";
  const port=Number(process.env.PORT||3200);
  const origin=release?.origin||process.env.APP_ORIGIN||(!production?"http://127.0.0.1:"+port:"");
  if(!origin||new URL(origin).origin!==origin||(production&&!origin.startsWith("https://")))throw new Error("Configure APP_ORIGIN com a origem HTTPS exata, sem barra final.");
  if(!publicRelease&&["nichodev.com","www.nichodev.com"].includes(new URL(origin).hostname))throw new Error("Use a entrada de produção protegida para o domínio público.");
  if(production&&!process.env.COMMUNITY_DATA_DIR)throw new Error("Configure COMMUNITY_DATA_DIR para um diretório persistente fora dos arquivos públicos.");
  const data=release?.data||path.resolve(process.env.COMMUNITY_DATA_DIR||path.join(__dirname,"../.data/community"));
  const publicRoots=[path.join(__dirname,"../public"),path.join(__dirname,"../server-pages"),path.join(__dirname,"../prototypes/community")];
  if(publicRoots.some(root=>{const relative=path.relative(root,data);return !relative||(!relative.startsWith("..")&&!path.isAbsolute(relative));}))throw new Error("O diretório de dados deve ficar fora das pastas públicas.");
  const bootstrapToken=process.env.COMMUNITY_BOOTSTRAP_TOKEN||"",bootstrapUser=process.env.COMMUNITY_BOOTSTRAP_USER||"";
  const app=createCommunityApp({dbPath:path.join(data,"community.sqlite"),origin,secure:production,trustedProxy:process.env.TRUSTED_PROXY||false,publicRelease,bootstrapToken,bootstrapUser,probeToken:process.env.COMMUNITY_PROXY_PROBE_TOKEN||""});
  if(publicRelease&&!app.locals.db.prepare("SELECT id FROM users WHERE admin=1 AND active=1").get()&&(!bootstrapToken||!bootstrapUser)){
    app.locals.close();throw new Error("Configure o convite privado do primeiro administrador antes de abrir produção.");
  }
  const server=app.listen(port,production?"0.0.0.0":"127.0.0.1",()=>console.log("Comunidade: "+origin+"/comunidade/"));
  const stop=()=>server.close(()=>{app.locals.close();process.exit(0);});
  process.once("SIGINT",stop);process.once("SIGTERM",stop);
  return {app,server};
}
if(require.main===module)start();
module.exports={start};
