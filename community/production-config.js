const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {isIP}=require("node:net");

function productionConfig(env=process.env,home=os.homedir()){
  if(env.COMMUNITY_PUBLIC_RELEASE!=="enabled")throw new Error("A comunidade em produção não foi liberada explicitamente.");
  if(Number(process.versions.node.split(".")[0])!==24)throw new Error("A entrada de produção exige Node.js 24.");
  if(env.NODE_ENV!=="production"||env.APP_ORIGIN!=="https://nichodev.com")throw new Error("Configure NODE_ENV=production e APP_ORIGIN=https://nichodev.com.");
  // This entry is specific to Hostinger; never reuse the staging database.
  const expected=path.join(fs.realpathSync(home),"domains/nichodev.com/community-private");
  const data=env.COMMUNITY_DATA_DIR;
  if(!data||!path.isAbsolute(data)||path.resolve(data)!==expected)throw new Error("Use a pasta privada própria de nichodev.com, separada da homologação.");
  if(fs.existsSync(data)&&fs.realpathSync(data)!==expected)throw new Error("A pasta de produção não pode apontar para outro diretório.");
  const proxies=(env.TRUSTED_PROXY||"").split(",").map(value=>value.trim());
  if(!proxies.every(value=>{
    const [ip,prefix,...extra]=value.split("/"),version=isIP(ip);
    return version&&!extra.length&&(prefix===undefined||(/^\d+$/.test(prefix)&&Number(prefix)>0&&Number(prefix)<=(version===4?32:128)));
  }))throw new Error("Configure TRUSTED_PROXY com IPs/CIDRs verificados.");
  return {origin:env.APP_ORIGIN,data};
}
module.exports={productionConfig};
