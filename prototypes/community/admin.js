(() => {
  'use strict';
  const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>value?new Date(value).toLocaleString('pt-BR'):'Sem registro';
  const bytes=value=>value===null?'Indisponível':(value/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MiB';
  const button=(label,action,id='')=>`<button type="button" class="text-link" data-admin-action="${action}" data-id="${escape(id)}">${escape(label)}</button>`;
  let request,root,current='stats',access,page=1,query='',state='pending',busy=false;
  const modules=[['stats','VISÃO GERAL','stats'],['users','USUÁRIOS','users'],['recovery','RECUPERAÇÃO','recovery'],['moderate','MODERAÇÃO','moderate'],['chars','NICO//CHAR','moderate'],['comments','COMENTÁRIOS','moderate'],['backups','BACKUPS','operations'],['health','SERVIDOR','operations'],['settings','CONFIGURAÇÕES','settings'],['audit','AUDITORIA','audit'],['feedback','AVALIAÇÕES','feedback']];
  function dialog(title,html,action){
    return new Promise((resolve,reject)=>{
      const d=document.createElement('dialog');d.setAttribute('aria-labelledby','adminDialogTitle');
      d.innerHTML=`<div class="dialog-heading"><h2 id="adminDialogTitle">${escape(title)}</h2><button class="close-button" type="button" aria-label="Cancelar operação">×</button></div><form>${html}<p class="form-error" role="alert"></p><button class="button primary full" type="submit">CONFIRMAR</button></form>`;
      let finished=false;d.querySelector('.close-button').onclick=()=>d.close();
      d.addEventListener('close',()=>{d.querySelectorAll('input,textarea').forEach(e=>e.value='');d.remove();if(!finished)reject(Error('Operação cancelada.'));});
      d.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{const result=await action(new FormData(e.target),d);finished=true;d.close();resolve(result);}catch(error){d.querySelector('[role=alert]').textContent=error.message;}finally{submit.disabled=false;}};
      document.body.append(d);d.showModal();
    });
  }
  const field=(name,label,value='',type='text',extra='')=>`<label for="adm-${name}">${escape(label)}</label><input id="adm-${name}" name="${name}" type="${type}" value="${escape(value)}" ${extra}>`;
  const why=()=>'<label for="adm-reason">MOTIVO</label><textarea id="adm-reason" name="reason" maxlength="500" required rows="3"></textarea>';
  const choice=(name,label,values)=>`<label for="adm-${name}">${escape(label)}</label><select id="adm-${name}" name="${name}">${values.map(([v,l])=>`<option value="${v}">${escape(l)}</option>`).join('')}</select>`;
  let unlocking=null;
  function unlock(call){if(!unlocking)unlocking=performUnlock(call).finally(()=>{unlocking=null;});return unlocking;}
  async function performUnlock(call){
    const a=await call('/admin/access');
    if(!a.enrolled){
      const setup=await dialog('ATIVAR SEGUNDO FATOR',`<p>Use um aplicativo autenticador. A configuração exige sua senha e a chave de recuperação da conta.</p>${field('current','SENHA ATUAL','','password','required autocomplete="current-password"')}${field('recoveryKey','CHAVE DE RECUPERAÇÃO','','password','required autocomplete="off"')}`,data=>call('/admin/mfa/setup',{method:'POST',body:Object.fromEntries(data)}));
      try{
        const result=await dialog('CONECTAR AUTENTICADOR',`<p>Adicione manualmente uma conta TOTP no aplicativo: Nichodev, SHA-1, 6 dígitos, 30 segundos.</p>${field('secret','CHAVE DO AUTENTICADOR',setup.secret,'text','readonly autocomplete="off"')}<p class="privacy-note">Guarde esta chave somente no autenticador.</p>${field('code','CÓDIGO DE 6 DÍGITOS','','text','required inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"')}`,data=>call('/admin/mfa/verify',{method:'POST',body:{code:data.get('code')}}));
        setup.secret='';setup.uri='';
        await dialog('GUARDE OS CÓDIGOS DE EMERGÊNCIA',`<p>Exibidos somente agora. Um código permite remover o autenticador perdido e cadastrar outro; cada código só pode ser usado uma vez.</p><pre class="admin-readonly">${escape(result.backupCodes.join('\n'))}</pre><label class="checkbox-label"><input type="checkbox" required> Guardei os códigos fora deste site.</label>`,async()=>{});
        result.backupCodes=[];
      }finally{setup.secret='';setup.uri='';}
    }else{
      await dialog('CONFIRMAR SEGUNDO FATOR',`${field('code','CÓDIGO DO APLICATIVO OU DE EMERGÊNCIA','','text','required autocomplete="one-time-code" maxlength="100"')}<label class="checkbox-label"><input name="backup" type="checkbox"> Usar código de emergência para cadastrar outro autenticador</label>`,async data=>{
        if(data.get('backup')){await call('/admin/mfa/backup',{method:'POST',body:{code:data.get('code')}});return 'reset';}
        await call('/admin/mfa/verify',{method:'POST',body:{code:data.get('code')}});
      }).then(async result=>{if(result==='reset')await performUnlock(call);});
    }
  }
  function table(headers,rows,caption=''){
    return `<div class="admin-table-wrap"><table class="admin-table">${caption?`<caption>${escape(caption)}</caption>`:''}<thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map(cell=>`<td>${cell}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${headers.length}">Nenhum registro nesta consulta.</td></tr>`}</tbody></table></div>`;
  }
  function pager(data){return `<div class="admin-pages"><button class="button outline compact" type="button" data-admin-action="prev" ${data.page<=1?'disabled':''}>← ANTERIOR</button><span>Página ${data.page} de ${Math.max(1,Math.ceil(data.total/data.size))} · ${data.total} registros</span><button class="button outline compact" type="button" data-admin-action="next" ${data.page*data.size>=data.total?'disabled':''}>PRÓXIMA →</button></div>`;}
  function stat(label,value,note=''){return `<div class="admin-stat"><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;}
  function listURL(path){return path+(path.includes('?')?'&':'?')+'page='+page+'&size=25';}
  async function render(){
    const host=root.querySelector('#adminContent');host.setAttribute('aria-busy','true');root.querySelector('#adminMessage').textContent='Carregando…';
    try{
      let html='';
      if(current==='stats'){
        const d=await request('/admin/stats'),t=d.totals,peak=Math.max(1,...d.registrations.map(x=>x.count));
        html=`<div class="admin-stats">${stat('Contas confirmadas',t.users)}${stat('Publicações aprovadas',t.approved)}${stat('Na fila de publicação',t.pending)}</div><h2>CADASTROS / ÚLTIMOS 30 DIAS</h2><div class="admin-bars" role="img" aria-label="Cadastros por dia; valores disponíveis na tabela abaixo">${d.registrations.map(x=>`<div class="admin-bar" style="height:${Math.max(2,x.count/peak*100)}%" title="${escape(x.day)}: ${x.count}"></div>`).join('')}</div>${table(['Dia (UTC)','Cadastros','Contas ativas'],d.registrations.map(x=>[escape(x.day),x.count,d.active.find(a=>a.day===x.day)?.count||0]))}<h2>ATIVIDADE DIÁRIA</h2>${table(['Dia (UTC)','Contas ativas'],d.active.map(x=>[escape(x.day),x.count]))}<h2>RETENÇÃO NO 7º DIA</h2>${table(['Coorte (UTC)','Contas','Retornaram no dia 7'],d.retention.map(x=>[escape(x.cohort),x.members,x.returnedDay7]))}<h2>PRESETS MAIS ABERTOS</h2>${table(['Preset','Aberturas'],d.presets.map(x=>[escape(x.title),x.uses]))}<p class="admin-muted">Áudio armazenado: ${bytes(t.audioBytes)}. ${escape(d.note)}</p>`;
      }else if(current==='users'){
        const d=await request(listURL('/admin/users?q='+encodeURIComponent(query)+'&status='+state));
        html=`<form class="admin-toolbar" id="adminSearch"><label>BUSCAR USUÁRIO<input name="q" maxlength="24" value="${escape(query)}" placeholder="Começa com…"></label><label>STATUS<select name="status">${[['all','Todos'],['active','Ativos'],['suspended','Suspensos'],['pending','Cadastro não confirmado']].map(([v,l])=>`<option value="${v}" ${v===state?'selected':''}>${l}</option>`).join('')}</select></label><button class="button outline compact" type="submit">BUSCAR</button></form>`;
        html+=table(['Conta / papel','Cadastro / atividade','Criações','Situação','Ações'],d.items.map(u=>[escape('@'+u.username)+'<br><small>'+escape(u.role)+'</small>',escape(date(u.created))+'<br><small>'+escape(date(u.last_seen))+'</small>',u.creations,escape(u.suspended?'Suspensa':u.active?'Ativa':'Não confirmada')+(u.publish_until>Date.now()?'<br>Publicação bloqueada':''),button('GERENCIAR','user',u.id)+button('HISTÓRICO','user-history',u.id)+(access.permissions.includes('roles')?button('RECOMPENSA CHAR','char-reward',u.id):'')]),'Atividade recente arredondada para a hora. Busca por prefixo.')+pager(d);
        host.users=d.items;
      }else if(current==='moderate'){
        const d=await request(listURL('/admin/creations?status='+state));
        html=`<div class="admin-toolbar">${[['pending','FILA'],['approved','APROVADAS'],['hidden','OCULTAS'],['reports','DENÚNCIAS']].map(([v,l])=>`<button class="button outline compact" type="button" data-admin-action="queue" data-id="${v}" aria-pressed="${v===state}">${l}</button>`).join('')}</div>`;
        html+=table(['Publicação','Autor / ocorrências','Data','Decisão'],d.items.map(x=>[escape(x.title)+'<br>'+escape(x.description),escape(x.author)+'<br>'+x.priorDecisions+' decisões de ocultação',escape(date(x.created)),button('REVISAR','moderate',x.id)+button('HISTÓRICO','creation-history',x.id)]))+pager(d);host.items=d.items;
      }else if(current==='reports'){
        const d=await request(listURL('/admin/reports?status='+state));html=`<div class="admin-toolbar">${[['pending','PENDENTES'],['reviewed','REVISADAS'],['dismissed','DESCARTADAS']].map(([v,l])=>`<button class="button outline compact" type="button" data-admin-action="report-filter" data-id="${v}">${l}</button>`).join('')}${button('VOLTAR À FILA','module','moderate')}</div>`+table(['Criação','Motivo','Data','Ação'],d.items.map(x=>[escape(x.title)+'<br>'+escape(x.creation_id),escape(x.reason),escape(date(x.created)),button('REVISAR DENÚNCIA','report',x.id)]))+pager(d);
      }else if(current==='comments'){
        const d=await request(listURL('/admin/comments?status='+state));host.comments=d.items;
        html='<div class="admin-toolbar">'+[['pending','PENDENTES'],['approved','APROVADOS'],['hidden','OCULTOS']].map(([v,l])=>button(l,'comment-filter',v)).join('')+'</div>'+table(['Comentário','Autor / publicação','Data','Ação'],d.items.map(x=>[escape(x.body),escape(x.username)+'<br>'+escape(x.title),escape(date(x.created)),button('REVISAR COMENTÁRIO','comment-review',x.id)]))+pager(d);
      }else if(current==='chars'){
        const d=await request(listURL('/admin/chars?status='+state));host.chars=d.items;
        html='<div class="admin-toolbar">'+[['pending','EM REVISÃO'],['ready','PUBLICÁVEIS'],['hidden','OCULTOS']].map(([v,l])=>button(l,'char-filter',v)).join('')+button('DENÚNCIAS DE CHARS','char-reports')+'</div>'+table(['Personagem','Conta / versão','Situação','Ações'],d.items.map(x=>['<canvas data-char-preview="'+escape(x.id)+'" width="128" height="128" style="width:96px;height:96px;image-rendering:pixelated"></canvas>',escape(x.username)+'<br>v'+x.revision,escape(x.status)+'<br>'+escape(x.reason),button('REVISAR CHAR','char-review',x.id)]))+pager(d);
      }else if(current==='charreports'){
        const d=await request(listURL('/admin/char-reports'));html=button('VOLTAR AOS CHARS','module','chars')+table(['Conta','Motivo','Data','Ação'],d.items.map(x=>[escape(x.username),escape(x.reason),escape(date(x.created)),button('REVISAR CHAR','char-review',x.user_id)]))+pager(d);
      }else if(current==='recovery'){
        const d=await request(listURL('/admin/recovery'));html='<p class="admin-alert">Somente solicitações com chave de recuperação verificada. A administração não recebe a chave, o token nem a nova senha. Sem prova previamente cadastrada, a conta não é liberada.</p>'+table(['Conta','Prova / situação','Validade','Ação'],d.items.map(x=>[escape(x.username),'Chave verificada<br>'+escape(x.status),escape(date(x.expires)),x.status==='pending'&&x.expires>Date.now()?button('REVISAR','recovery',x.id):escape(x.reason)]))+pager(d);
      }else if(current==='backups'){
        const d=await request('/admin/backups'),status=r=>!r?'Sem confirmação':r.ok===false?'Falhou':r.integrity===true?'Integridade verificada':'Execução registrada';
        html=table(['Rotina','Último registro','Resultado'],[['Backup local',escape(date(d.local?.at)),d.local?'Arquivo presente; '+(d.local.integrity===true?'integridade verificada':'integridade sem confirmação'):'Sem confirmação'],['Execução local',escape(date(d.localRun?.at)),status(d.localRun)],['Cloudflare R2',escape(date(d.r2?.at)),status(d.r2)],['Execução R2',escape(date(d.r2Run?.at)),status(d.r2Run)],['Restauração isolada',escape(date(d.restore?.at)),status(d.restore)],['Monitor',escape(date(d.monitor?.checkedAt)),d.monitor?d.monitor.ok?'Saudável':'Atenção':'Sem confirmação']]);
        html+='<p class="admin-muted">Consulta de recibos privados deste ambiente. Recibos ausentes ou inválidos não comprovam sucesso. Restauração exige procedimento operacional com backup e conferência dos dados atuais.</p>';
      }else if(current==='health'){
        const d=await request('/admin/health');html=`<div class="admin-stats">${stat('API p95',d.p95Ms+' ms',d.sampleSize+' amostras')}${stat('Memória RSS',bytes(d.memoryBytes),'Processo atual')}${stat('Áudio',bytes(d.audioBytes),'Armazenamento no SQLite')}</div>${d.alerts.map(x=>`<p class="admin-alert">${escape(x)}</p>`).join('')}${table(['Indicador','Valor'],[['Pedidos / erros 5xx',d.requests+' / '+d.errors],['Pedidos em andamento',d.inFlight],['Consulta SQLite',d.dbMs+' ms'],['SQLite + WAL',bytes(d.sqliteBytes)+' + '+bytes(d.walBytes)],['Espaço livre no volume',bytes(d.freeBytes)],['Sessões vigentes',d.sessions],['Atualização',escape(date(d.checkedAt))]])}<p class="admin-muted">${escape(d.scope)} Atualize para medir novamente.</p>`;
      }else if(current==='settings'){
        const d=await request('/admin/settings'),v=d.value;host.settings=d;
        html=`<form id="adminSettings"><div class="admin-grid">${[['uploadMB','LIMITE POR WAV (MiB, ATÉ 10)'],['accountAudioMB','ÁUDIO POR CONTA (MiB)'],['totalAudioMB','ÁUDIO NO AMBIENTE (MiB)'],['creationLimit','CRIAÇÕES POR CONTA'],['rolloutPercent','LIBERAÇÃO DOS NOVOS RECURSOS (%)']].map(([k,l])=>'<div>'+field(k,l,v[k],'number',k==='rolloutPercent'?'min="0" max="100" required':'min="1" required')+'</div>').join('')}</div>${[['registrationsOpen','Cadastros abertos',v.registrationsOpen],['publicationOpen','Publicações públicas abertas',v.publicationOpen],['reports','Denúncias liberadas',v.features.reports],['assistedRecovery','Recuperação assistida liberada',v.features.assistedRecovery]].map(([k,l,on])=>`<label class="admin-boolean"><input name="${k}" type="checkbox" ${on?'checked':''}> ${l}</label>`).join('')}${field('maintenanceMessage','MENSAGEM DE MANUTENÇÃO',v.maintenanceMessage,'text','maxlength="240"')}<label for="adm-rules">REGRAS DE PUBLICAÇÃO</label><textarea id="adm-rules" name="rules" required maxlength="1000">${escape(v.rules)}</textarea>${why()}<p class="admin-muted">Fechar publicações impede novas publicações e edições públicas. O percentual libera denúncias e recuperação assistida para uma parcela estável das contas, sem rastrear navegação.</p><button class="button primary" type="submit">SALVAR CONFIGURAÇÕES</button></form>`;
      }else if(current==='audit'){
        const d=await request(listURL('/admin/audit'));html=table(['Quando / quem','Ação / resultado','Alvo','Motivo'],d.items.map(x=>[escape(date(x.created))+'<br>'+escape(x.actor_name),escape(x.action)+'<br>'+escape(x.result),escape(x.target),escape(x.reason)]))+pager(d)+'<p class="admin-muted">Registro de ações e recusas. Não contém senhas, chaves ou tokens. O painel não permite apagar registros.</p>';
      }else if(current==='feedback'){
        const d=await request(listURL('/admin/feedback?status='+state));html='<label class="inline-label" for="feedbackFilter">SITUAÇÃO <select id="feedbackFilter">'+[['all','Todas'],['recebido','Recebido'],['analise','Em análise'],['concluido','Concluído']].map(([v,l])=>`<option value="${v}" ${v===state?'selected':''}>${l}</option>`).join('')+'</select></label><div id="feedbackList">'+table(['Ferramenta / data','Comentário privado','Contato','Situação'],d.items.map(x=>[escape(x.tool)+'<br>'+escape(date(x.created)),escape(x.comment),escape(x.contact),`<select data-feedback="${escape(x.id)}" data-current="${escape(x.status)}" aria-label="Situação da avaliação">${[['recebido','Recebido'],['analise','Em análise'],['concluido','Concluído']].map(([v,l])=>`<option value="${v}" ${v===x.status?'selected':''}>${l}</option>`).join('')}</select>`]))+'</div>'+pager(d);
      }
      host.innerHTML=html;if(current==='chars')host.querySelectorAll('[data-char-preview]').forEach(canvas=>{const x=host.chars.find(x=>x.id===canvas.dataset.charPreview);window.NicoCharArt.paint(canvas,x.design);});root.querySelector('#adminTitle').textContent=modules.find(m=>m[0]===current)?.[1]||'DENÚNCIAS';root.querySelectorAll('[data-module]').forEach(b=>b.setAttribute('aria-current',b.dataset.module===(current==='reports'?'moderate':current)?'page':'false'));root.querySelector('#adminMessage').textContent='Atualizado em '+new Date().toLocaleTimeString('pt-BR');
    }catch(error){root.querySelector('#adminMessage').textContent=error.message;throw error;}finally{host.setAttribute('aria-busy','false');}
  }
  async function history(path,title){
    let p=1;const d=document.createElement('dialog');d.setAttribute('aria-label',title);document.body.append(d);
    async function load(){const data=await request(path+'?page='+p+'&size=25');d.innerHTML=`<div class="dialog-heading"><h2>${escape(title)}</h2><button class="close-button" type="button" aria-label="Fechar histórico">×</button></div>`+table(['Data','Decisão / ação','Motivo'],data.items.map(x=>[escape(date(x.created)),escape(x.decision||x.action),escape(x.reason)]))+pager(data);d.querySelector('.close-button').onclick=()=>d.close();d.querySelector('[data-admin-action=prev]').onclick=async()=>{p--;await load();};d.querySelector('[data-admin-action=next]').onclick=async()=>{p++;await load();};}
    try{await load();d.addEventListener('close',()=>d.remove());d.showModal();}catch(e){d.remove();throw e;}
  }
  async function act(action,id){
    const host=root.querySelector('#adminContent');
    if(action==='prev')page--;else if(action==='next')page++;
    else if(action==='module'){current=id;page=1;state=id==='users'||id==='feedback'?'all':'pending';}
    else if(action==='queue'){if(id==='reports'){current='reports';state='pending';}else state=id;page=1;}
    else if(action==='comment-filter'){current='comments';state=id;page=1;}
    else if(action==='char-filter'){current='chars';state=id;page=1;}
    else if(action==='char-reports'){current='charreports';page=1;}
    else if(action==='report-filter'){state=id;page=1;}
    else if(action==='user-history'){await history('/admin/users/'+id+'/history','HISTÓRICO DA CONTA');return;}
    else if(action==='creation-history'){await history('/admin/creations/'+id+'/history','HISTÓRICO DA PUBLICAÇÃO');return;}
    else if(action==='user'){
      const u=host.users.find(x=>x.id===id);await dialog('GERENCIAR @'+u.username,choice('action','AÇÃO',[['sessions','Encerrar todas as sessões'],['suspend','Suspender conta'],['reactivate','Reativar conta'],['publication-block','Bloquear ou liberar publicações'],...(access.permissions.includes('roles')?[['role','Alterar papel']]:[])])+field('days','BLOQUEIO DE PUBLICAÇÃO EM DIAS (0 PARA LIBERAR)',1,'number','min="0" max="30"')+(access.permissions.includes('roles')?choice('role','NOVO PAPEL',[['member','Membro'],['moderator','Moderador'],['admin','Administrador'],['owner','Proprietário']]):'')+why(),async data=>{
        const body=Object.fromEntries(data),route=body.action==='role'?'/role':'';if(body.action==='publication-block')body.until=Number(body.days)?Date.now()+Number(body.days)*86400000:0;
        await request('/admin/users/'+id+route,{method:'PATCH',body});
      });
    }else if(action==='moderate'){
      const x=host.items.find(x=>x.id===id);await dialog('REVISAR PUBLICAÇÃO',`<h3>${escape(x.title)}</h3><p>${escape(x.description)}</p>${x.mediaId?`<audio controls preload="none" src="/api/community/media/${encodeURIComponent(x.mediaId)}"></audio>`:''}<p>Autor: ${escape(x.author)}. Decisões de ocultação anteriores: ${x.priorDecisions}.</p>`+choice('status','DECISÃO',[['approved','Aprovar'],['hidden','Ocultar'],['pending','Reabrir revisão']])+why(),data=>request('/admin/creations/'+id,{method:'PATCH',body:{...Object.fromEntries(data),version:x.version}}));
    }else if(action==='comment-review'){
      const x=host.comments.find(x=>String(x.id)===id);await dialog('REVISAR COMENTÁRIO','<p>'+escape(x.body)+'</p>'+choice('status','DECISÃO',[['approved','Aprovar'],['hidden','Ocultar'],['pending','Reabrir revisão']])+why(),data=>request('/admin/comments/'+id,{method:'PATCH',body:{...Object.fromEntries(data),revision:x.revision}}));
    }else if(action==='char-review'){
      const x=await request('/admin/chars/'+id);const pending=dialog('REVISAR NICO//CHAR','<p>@'+escape(x.username)+' · '+escape(x.design.name)+'</p><canvas id="adm-char-review" width="256" height="256" style="width:256px;max-width:100%;image-rendering:pixelated"></canvas>'+choice('status','DECISÃO',[['ready','Aprovar'],['hidden','Ocultar'],['pending','Reabrir revisão']])+why(),data=>request('/admin/chars/'+id,{method:'PATCH',body:{...Object.fromEntries(data),revision:x.revision}}));window.NicoCharArt.paint(document.getElementById('adm-char-review'),x.design);await pending;
    }else if(action==='char-reward'){
      await dialog('CONCEDER COSMÉTICO',choice('badge','EVENTO REAL',[['halloween','Halloween'],['natal','Natal retrô'],['aniversario','Aniversário NICHODEVS'],['desafio','Desafio concluído']])+why(),data=>request('/admin/chars/'+id+'/reward',{method:'POST',body:Object.fromEntries(data)}));
    }else if(action==='report'){
      await dialog('REVISAR DENÚNCIA','<p>Classificar a denúncia não altera a publicação. Abra a fila de publicações para decidir sobre o conteúdo.</p>'+choice('status','RESULTADO',[['reviewed','Revisada'],['dismissed','Descartada']])+why(),data=>request('/admin/reports/'+id,{method:'PATCH',body:Object.fromEntries(data)}));
    }else if(action==='recovery'){
      await dialog('REVISAR RECUPERAÇÃO','<p>A chave foi validada pelo sistema. Aprovar permite que o solicitante defina a própria senha com seu token privado. As sessões serão encerradas.</p>'+choice('status','DECISÃO',[['approved','Aprovar'],['denied','Recusar']])+why(),data=>request('/admin/recovery/'+id,{method:'PATCH',body:Object.fromEntries(data)}));
    }
    await render();root.querySelector('#adminTitle').focus();
  }
  async function mount(host,call,user){
    request=call;root=host;if(!user?.admin){root.textContent='Acesso restrito à administração.';return;}
    access=await request('/admin/access');await request('/admin/'+(access.permissions.includes('stats')?'stats':'creations'));
    const allowed=modules.filter(m=>access.permissions.includes(m[2]));if(!allowed.some(m=>m[0]===current)&&current!=='reports'){current=allowed[0][0];state=current==='users'||current==='feedback'?'all':'pending';}
    root.innerHTML=`<div class="admin-console"><aside class="admin-side"><p class="eyebrow">NICHODEV<br>CONTROL ROOM / 8 BIT</p><nav aria-label="Módulos administrativos">${allowed.map(([key,title])=>`<button type="button" data-module="${key}" data-admin-action="module" data-id="${key}">${title}</button>`).join('')}</nav></aside><div class="admin-main"><header class="admin-top"><div><p class="eyebrow">COMUNIDADE / ADMINISTRAÇÃO</p><h1 id="adminTitle" tabindex="-1">PAINEL DE CONTROLE</h1><span class="admin-role">@${escape(user.username)} · ${escape(access.role)} · MFA</span></div><button class="button outline compact" type="button" data-admin-action="refresh">ATUALIZAR ↻</button></header><div id="adminContent"></div><p class="admin-message" id="adminMessage" role="status" aria-live="polite"></p></div></div>`;
    root.onclick=async e=>{const b=e.target.closest('[data-admin-action]');if(!b||busy)return;busy=true;b.disabled=true;try{await act(b.dataset.adminAction,b.dataset.id);}catch(error){root.querySelector('#adminMessage').textContent=error.message;}finally{busy=false;if(b.isConnected)b.disabled=false;}};
    root.onchange=async e=>{
      try{if(e.target.id==='feedbackFilter'){state=e.target.value;page=1;await render();}else if(e.target.dataset.feedback){const focused=e.target;focused.disabled=true;try{await request('/admin/feedback/'+focused.dataset.feedback,{method:'PATCH',body:{status:focused.value}});focused.dataset.current=focused.value;}catch(error){focused.value=focused.dataset.current;throw error;}finally{focused.disabled=false;focused.focus();}}}catch(error){root.querySelector('#adminMessage').textContent=error.message;}
    };
    root.onsubmit=async e=>{
      e.preventDefault();if(busy)return;busy=true;const form=e.target,submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
      try{const data=new FormData(form);if(form.id==='adminSearch'){query=data.get('q');state=data.get('status');page=1;}else if(form.id==='adminSettings'){
        const old=root.querySelector('#adminContent').settings,v=structuredClone(old.value);for(const k of ['uploadMB','accountAudioMB','totalAudioMB','creationLimit','rolloutPercent'])v[k]=Number(data.get(k));for(const k of ['registrationsOpen','publicationOpen'])v[k]=data.has(k);for(const k of ['reports','assistedRecovery'])v.features[k]=data.has(k);v.maintenanceMessage=data.get('maintenanceMessage');v.rules=data.get('rules');await request('/admin/settings',{method:'PUT',body:{value:v,version:old.version,reason:data.get('reason')}});
      }await render();}catch(error){root.querySelector('#adminMessage').textContent=error.message;}finally{busy=false;if(submit?.isConnected)submit.disabled=false;}
    };
    state=current==='users'||current==='feedback'?'all':state;await render();
  }
  async function report(call,id){await dialog('DENUNCIAR PUBLICAÇÃO',why(),data=>call('/creations/'+id+'/report',{method:'POST',body:Object.fromEntries(data)}));}
  async function assisted(call){
    const step=await dialog('RECUPERAÇÃO ASSISTIDA','<p>Você precisa da chave de recuperação. Sem ela, a administração não pode comprovar a titularidade. Solicitar encerra sessões e abre uma revisão válida por 24 horas.</p>'+choice('step','ETAPA',[['start','Abrir solicitação'],['complete','Concluir solicitação aprovada']]),async data=>data.get('step'));
    if(step==='start'){
      const d=await dialog('VERIFICAR TITULARIDADE',field('username','USUÁRIO','','text','required maxlength="24"')+field('recoveryKey','CHAVE DE RECUPERAÇÃO','','password','required autocomplete="off"'),data=>call('/recovery-requests',{method:'POST',body:Object.fromEntries(data)}));
      await dialog('GUARDE O PROTOCOLO',`<p>Guarde o ID e o token privado. Volte à etapa “Concluir solicitação aprovada” depois da revisão. Não envie o token à administração.</p>${field('id','ID DA SOLICITAÇÃO',d.id,'text','readonly')}${field('token','TOKEN PRIVADO',d.token,'text','readonly')}<label class="checkbox-label"><input type="checkbox" required> Guardei o protocolo em local privado.</label>`,async()=>{});d.token='';
    }else{
      const d=await dialog('DEFINIR NOVA SENHA',field('id','ID DA SOLICITAÇÃO','','text','required')+field('token','TOKEN PRIVADO','','password','required autocomplete="off"')+field('password','NOVA SENHA','','password','required minlength="15" maxlength="128" autocomplete="new-password"')+field('confirm','CONFIRMAR NOVA SENHA','','password','required minlength="15" maxlength="128" autocomplete="new-password"'),data=>{if(data.get('password')!==data.get('confirm'))throw Error('As senhas não conferem.');return call('/recovery-requests/'+encodeURIComponent(data.get('id'))+'/complete',{method:'POST',body:Object.fromEntries(data)});});
      await dialog('GUARDE A NOVA CHAVE',field('key','NOVA CHAVE DE RECUPERAÇÃO',d.recoveryKey,'text','readonly')+'<label class="checkbox-label"><input type="checkbox" required> Guardei a nova chave.</label>',async()=>{});d.recoveryKey='';
    }
  }
  window.NichodevAdmin={mount,unlock,report,assisted};
})();
