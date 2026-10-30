(function(root){"use strict";
  const presets={
    arcade:["#10160f","#192217","#edf3e4","#c9f27a","#d5b5ff"],
    noite:["#101425","#1b2340","#eef2ff","#8de5ff","#e3b8ff"],
    ambar:["#1b140b","#2c2112","#fff1d6","#ffd074","#ffbca5"],
    clara:["#faf7ef","#ffffff","#25251e","#35621c","#7042a0"]
  };
  function luminance(hex){
    const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  }
  function valid(colors){
    if(!Array.isArray(colors)||colors.length!==5||!colors.every(color=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color)))return false;
    const light=colors.map(luminance);
    return light.slice(2).every(text=>light.slice(0,2).every(bg=>(Math.max(text,bg)+.05)/(Math.min(text,bg)+.05)>=4.5));
  }
const api={presets,luminance,valid}; if(typeof module==="object"&&module.exports)module.exports=api;else root.NichodevPalettes=api;})(typeof globalThis!=="undefined"?globalThis:this);