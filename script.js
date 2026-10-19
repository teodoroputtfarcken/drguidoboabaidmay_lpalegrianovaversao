'use strict';
const PHQ = [
  "Pouco interesse ou pouco prazer em fazer as coisas.",
  "Sentir-se para baixo, deprimido(a) ou sem esperança.",
  "Dificuldade para adormecer, permanecer dormindo ou dormir demais.",
  "Sentir-se cansado(a) ou com pouca energia.",
  "Falta de apetite ou comer em excesso.",
  "Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou a si mesmo(a) ou sua família.",
  "Dificuldade para se concentrar em coisas, como ler o jornal ou assistir à televisão.",
  "Movimentar-se ou falar tão devagar que outras pessoas poderiam ter percebido; ou o contrário — estar tão inquieto(a) ou agitado(a) que se movimenta muito mais que o habitual.",
  "Pensar que seria melhor estar morto(a), ou pensar em se ferir de alguma maneira."
];

const GAD = [
  "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a).",
  "Não conseguir parar ou controlar as preocupações.",
  "Preocupar-se demais com diferentes coisas.",
  "Dificuldade para relaxar.",
  "Ficar tão inquieto(a) que é difícil permanecer sentado(a).",
  "Ficar facilmente irritado(a) ou aborrecido(a).",
  "Sentir medo, como se algo terrível pudesse acontecer."
];

const OPTS = ["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"];

const READINGS = {
  phq: {
    min: "Suas respostas sobre humor não indicam sinais relevantes nas últimas duas semanas.",
    mild: "Suas respostas mostram alguns sinais leves de humor mais baixo. Vale continuar de olho em como você tem se sentido.",
    mod: "Suas respostas mostram sinais moderados de humor deprimido. Conversar com um profissional de saúde mental pode ajudar a entender melhor o que está acontecendo.",
    modsev: "Suas respostas mostram sinais mais intensos, moderadamente graves. Recomendamos buscar avaliação profissional em breve.",
    sev: "Suas respostas mostram sinais consistentes com sofrimento significativo. Buscar ajuda profissional o quanto antes é o passo mais importante agora."
  },
  gad: {
    min: "Suas respostas sobre ansiedade não indicam sinais relevantes nas últimas duas semanas.",
    mild: "Suas respostas mostram sinais leves de ansiedade. Vale observar como isso evolui.",
    mod: "Suas respostas mostram sinais moderados de ansiedade. Uma conversa com um profissional pode trazer mais clareza.",
    sev: "Suas respostas mostram sinais de ansiedade grave. Recomendamos buscar apoio profissional o quanto antes."
  }
};

const BANDS = {
  phq: [
    [4, "min", "sintomas mínimos"],
    [9, "mild", "sintomas leves"],
    [14, "mod", "sintomas moderados"],
    [19, "modsev", "sintomas moderadamente graves"],
    [27, "sev", "sintomas graves"]
  ],
  gad: [
    [4, "min", "ansiedade mínima"],
    [9, "mild", "ansiedade leve"],
    [14, "mod", "ansiedade moderada"],
    [21, "sev", "ansiedade grave"]
  ]
};

const $ = id => document.getElementById(id);
const WA = 'https://api.whatsapp.com/send/?phone=554898510053&text=' + encodeURIComponent('Olá, vim da Sala de Escuta e gostaria de conversar sobre uma avaliação.');
const state = { mode: '', questions: [], answers: {}, index: 0, screen: 'home', editing: false, contact: {name:'',phone:'',email:'',consent:false}, sent: false, sending: false, error: false };
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function score(kind) { return state.questions.filter(q => q.kind === kind).reduce((sum,q) => sum + (state.answers[q.id] ?? 0),0); }
function band(kind,value) { return BANDS[kind].find(row => value <= row[0]); }
function safety() { return `<aside class="safety" role="note"><h3>Você merece cuidado e apoio.</h3><p>Essa resposta merece atenção, independentemente da pontuação. Converse com um profissional de saúde. Se houver risco imediato de você se machucar, procure um serviço de emergência e peça a alguém de confiança para ficar com você. Não espere o contato da clínica.</p><div class="safety-links"><a href="tel:+55188?oai_link_source=model_response_hotline">CVV · 188</a><a href="https://www.cvv.org.br/chat/?oai_link_source=model_response_hotline" target="_blank" rel="noopener">Conversar com o CVV ↗</a></div><p style="margin-top:10px">Apoio emocional gratuito, 24 horas. Este formulário não é monitorado em tempo real.</p></aside>`; }
function hasAlert() { return (state.answers.phq9 || 0) > 0; }
function activateStep(n) { $('change-test').hidden=n===2; ['step-test','step-contact','step-result'].forEach((id,i)=>{ $(id).classList.toggle('active',i===n); if(i===n)$(id).setAttribute('aria-current','step');else $(id).removeAttribute('aria-current'); }); }
function focusStage(id) { requestAnimationFrame(()=>{ const el=$(id);if(el){el.setAttribute('tabindex','-1');el.focus({preventScroll:true});} const target=$('experience');window.scrollTo({top:Math.max(0,target.offsetTop-12),behavior:'instant'}); }); }
function start(mode) {
 state.mode=mode;state.questions=[];state.answers={};state.index=0;state.sent=false;state.error=false;state.editing=false;
 for (const [kind,texts] of [['phq',PHQ],['gad',GAD]]) { if(mode==='both'||mode===kind) texts.forEach((text,i)=>state.questions.push({id:kind+(i+1),kind,text,n:i+1})); }
 $('home').hidden=true;$('experience').hidden=false;renderQuestion();
}
function progress() { const answered=state.questions.filter(q=>state.answers[q.id]!==undefined).length;return `<div class="progress-label"><strong>${state.mode==='both'?'Humor e ansiedade':state.mode==='phq'?'Meu humor':'Minha ansiedade'}</strong><span>${answered} de ${state.questions.length} respondidas</span></div><div class="progress-track" role="progressbar" aria-label="Perguntas respondidas" aria-valuemin="0" aria-valuemax="${state.questions.length}" aria-valuenow="${answered}"><span style="width:${answered/state.questions.length*100}%"></span></div>`; }
function renderQuestion() {
 state.screen='question';activateStep(0);const q=state.questions[state.index],value=state.answers[q.id];
 $('stage').innerHTML=`<section class="question-panel">${progress()}<div class="question-category">${q.kind==='phq'?'HUMOR · PHQ-9':'ANSIEDADE · GAD-7'} <span aria-hidden="true">/</span> PERGUNTA ${q.n} DE ${q.kind==='phq'?9:7}</div><p class="question-period">Nas últimas duas semanas, com que frequência você teve:</p><h2 class="question-title" id="question-title">${escapeHTML(q.text)}</h2><fieldset class="options"><legend class="sr-only">Escolha uma frequência para esta pergunta</legend>${OPTS.map((label,v)=>`<label class="option"><input type="radio" name="answer" value="${v}" ${value===v?'checked':''}><span>${label}</span></label>`).join('')}</fieldset><div id="safety-slot">${q.id==='phq9'&&value>0?safety():''}</div><div class="question-controls"><button class="text-button" id="prev">← ${state.index===0?'Escolher teste':'Voltar'}</button><button class="button primary" id="next" ${value===undefined?'disabled':''}>${state.editing?'Salvar resposta':state.index===state.questions.length-1?'Revisar respostas':'Continuar'} <span aria-hidden="true">→</span></button></div></section><p class="under-panel">${state.editing?'Ao salvar, você volta à revisão.':'Escolha uma resposta e toque em Continuar.'}</p>`;
 document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener('change',()=>{
  state.answers[q.id]=Number(input.value);state.sent=false;$('next').disabled=false;
  const answered=state.questions.filter(i=>state.answers[i.id]!==undefined).length;
  document.querySelector('.progress-label>span').textContent=`${answered} de ${state.questions.length} respondidas`;
  const bar=document.querySelector('.progress-track');bar.setAttribute('aria-valuenow',answered);bar.firstElementChild.style.width=answered/state.questions.length*100+'%';
  if(q.id==='phq9'){$('safety-slot').innerHTML=Number(input.value)>0?safety():'';if(Number(input.value)>0)$('safety-slot').setAttribute('aria-live','polite');}
 }));
 $('prev').onclick=()=>{if(state.editing){state.editing=false;renderReview();}else if(state.index===0)requestReset();else{state.index--;renderQuestion();}};
 $('next').onclick=()=>{if(state.answers[q.id]===undefined)return;if(state.editing){state.editing=false;renderReview();}else if(state.index===state.questions.length-1)renderReview();else{state.index++;renderQuestion();}};
 focusStage('question-title');
}
function renderReview(){
 state.screen='review';activateStep(0);
 $('stage').innerHTML=`<section class="review-panel"><div class="eyebrow">QUESTIONÁRIO CONCLUÍDO</div><h2 id="review-title">Tudo do seu jeito?</h2><p class="panel-description">Confira suas respostas antes de continuar. Se precisar, você pode alterar qualquer uma.</p>${hasAlert()?safety():''}<ol class="review-list">${state.questions.map((q,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><div><p>${escapeHTML(q.text)}</p><strong>${OPTS[state.answers[q.id]]}</strong></div><button data-edit="${i}" aria-label="Alterar resposta da pergunta ${i+1}">Alterar</button></li>`).join('')}</ol><button class="button primary full-width" id="go-contact">Continuar para meus dados <span aria-hidden="true">→</span></button></section>`;
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.index=Number(b.dataset.edit);state.editing=true;renderQuestion();});$('go-contact').onclick=()=>renderContact();focusStage('review-title');
}
function renderContact(){
 state.screen='contact';activateStep(1);const c=state.contact;
 $('stage').innerHTML=`<section class="contact-panel"><div class="eyebrow">02 / SEUS DADOS</div><h2 id="contact-title">Seu resultado está pronto.</h2><p class="panel-description">Preencha seus dados para compartilhar as pontuações com a equipe da clínica e consultar seu resultado.</p>${hasAlert()?safety():''}<form id="lead-form"><label class="field" for="lead-name">Nome completo<input id="lead-name" name="nome" autocomplete="name" maxlength="120" placeholder="Como podemos chamar você?" required value="${escapeHTML(c.name)}"></label><label class="field" for="lead-phone">WhatsApp com DDD<input id="lead-phone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" placeholder="(00) 00000-0000" required value="${escapeHTML(c.phone)}" aria-describedby="phone-help"></label><span class="sr-only" id="phone-help">Inclua DDD. Para números internacionais, inclua mais e o código do país.</span><label class="field" for="lead-email">E-mail<input id="lead-email" name="email" type="email" autocomplete="email" maxlength="180" placeholder="voce@exemplo.com" required value="${escapeHTML(c.email)}"></label><label class="consent"><input type="checkbox" id="lead-consent" required ${c.consent?'checked':''}><span>Autorizo o envio do meu nome, WhatsApp, e-mail e pontuações dos testes à equipe da clínica do Dr. Guido Boabaid para atendimento e contato sobre esta avaliação.</span></label><details class="privacy-detail"><summary>Entenda o que será compartilhado</summary><p>Serão enviados seus dados de contato, a pontuação de cada teste concluído, a origem da página e a data do envio. As respostas individuais não são enviadas. A integração utiliza n8n e o sistema de atendimento da clínica. Para dúvidas ou solicitações sobre seus dados: <a href="mailto:contato@guidoboabaid.com.br">contato@guidoboabaid.com.br</a>.</p></details><div id="form-error" role="alert" ${state.error?'':'hidden'} class="form-error">Não foi possível confirmar o envio. Você pode tentar novamente ou consultar seu resultado abaixo. O envio pode ter sido recebido; evite repetir muitas vezes.</div><button class="button primary full-width" type="submit" id="send-lead">Enviar e ver meu resultado <span aria-hidden="true">→</span></button><button type="button" class="text-button fallback" id="fallback" ${state.error?'':'hidden'}>Ver resultado sem reenviar</button></form><div class="question-controls"><button class="text-button" id="back-review">← Revisar respostas</button><span style="font-size:10px;color:var(--muted)">Formulário de atendimento</span></div></section>`;
 for(const [id,key] of [['lead-name','name'],['lead-phone','phone'],['lead-email','email']]) $(id).addEventListener('input',()=>{state.contact[key]=$(id).value;$(id).setCustomValidity('');});
 $('lead-consent').onchange=()=>state.contact.consent=$('lead-consent').checked;
 $('back-review').onclick=()=>renderReview();$('fallback').onclick=()=>renderResults(false);
 $('lead-form').onsubmit=submitLead;focusStage('contact-title');
}
async function submitLead(event){
 event.preventDefault();if(state.sending)return;state.contact={name:$('lead-name').value,phone:$('lead-phone').value,email:$('lead-email').value,consent:$('lead-consent').checked};const c=state.contact;
 if(!c.name.trim()){$('lead-name').setCustomValidity('Informe seu nome.');$('lead-name').reportValidity();return;}
 const digits=c.phone.replace(/\D/g,'');if(digits.length<10||digits.length>15){$('lead-phone').setCustomValidity('Informe um telefone com DDD, entre 10 e 15 dígitos.');$('lead-phone').reportValidity();return;}
 if(!$('lead-form').reportValidity()||!c.consent)return;
 state.sending=true;$('send-lead').disabled=true;$('send-lead').textContent='Enviando…';$('lead-form').setAttribute('aria-busy','true');$('form-error').hidden=true;$('fallback').hidden=true;$('back-review').disabled=true;$('change-test').disabled=true;
 const payload={nome:c.name.trim(),telefone:c.phone.trim(),email:c.email.trim(),origem:'Sala de Escuta',phq9:state.mode==='gad'?null:score('phq'),gad7:state.mode==='phq'?null:score('gad'),pagina:location.href};
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),22000);
 try{
  const response=await fetch('enviar-lead.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  const data=await response.json();if(!response.ok||data.ok!==true)throw new Error('send_failed');
  state.sent=true;state.error=false;renderResults(true);
 }catch(error){state.error=true;$('form-error').hidden=false;$('fallback').hidden=false;$('send-lead').disabled=false;$('send-lead').textContent='Tentar enviar novamente';$('lead-form').removeAttribute('aria-busy');$('back-review').disabled=false;}
 finally{clearTimeout(timer);state.sending=false;$('change-test').disabled=false;}
}
function renderResults(sent){
 state.screen='result';activateStep(2);
 const cards=['phq','gad'].filter(k=>state.mode==='both'||state.mode===k).map(kind=>{
  const value=score(kind),max=kind==='phq'?27:21,b=band(kind,value);
  return `<article class="result-card"><div class="result-card-top"><div><div class="result-kicker">${kind==='phq'?'PHQ-9':'GAD-7'}</div><h3>${kind==='phq'?'Seu humor':'Sua ansiedade'}</h3></div><div class="score">${value}<small> / ${max}</small></div></div><span class="result-band">${b[2][0].toUpperCase()+b[2].slice(1)}</span><div class="score-bar" aria-hidden="true"><span class="score-pin" style="left:${Math.max(1,Math.min(99,value/max*100))}%"></span></div><div class="score-labels" aria-hidden="true"><span>0 pontos</span><span>${max} pontos</span></div><p>${READINGS[kind][b[1]]}</p></article>`;
 }).join('');
 $('stage').innerHTML=`<section class="results-panel"><div class="eyebrow">03 / SEU RESULTADO</div><h2 id="result-title">Um olhar para o seu momento.</h2><p class="panel-description">Estas pontuações refletem suas respostas sobre as últimas duas semanas.</p>${hasAlert()?safety():''}${cards}<p class="result-explainer"><strong>Você é mais do que uma pontuação.</strong><br>Este resultado não confirma nem descarta um diagnóstico. Seu momento de vida, sua história e a avaliação de um profissional ajudam a compreender o que você está sentindo.</p><div class="result-cta"><h3>Você não precisa entender tudo sozinho.</h3><p>Nossa equipe pode orientar você sobre uma avaliação individualizada.</p><a href="${WA}" target="_blank" rel="noopener" class="button green">Conversar com a equipe <span aria-hidden="true">↗</span></a></div><p class="result-status">${sent?'Seu contato e as pontuações foram encaminhados ao sistema de atendimento. Isso não confirma um agendamento.':'Não foi possível confirmar o envio à clínica. Seu resultado foi calculado neste navegador.'}</p><div class="result-actions"><button class="text-button" id="print-result">Imprimir resultado ↗</button></div><details class="references"><summary>Entenda as faixas de pontuação</summary><p>Humor (PHQ-9): 0–4 mínimos; 5–9 leves; 10–14 moderados; 15–19 moderadamente graves; 20–27 graves.</p><p>Ansiedade (GAD-7): 0–4 mínima; 5–9 leve; 10–14 moderada; 15–21 grave.</p><p>Referências dos instrumentos:</p><ul><li><a href="https://doi.org/10.1046/j.1525-1497.2001.016009606.x" target="_blank" rel="noopener">Kroenke, Spitzer e Williams — PHQ-9 (2001)</a></li><li><a href="https://doi.org/10.1001/archinte.166.10.1092" target="_blank" rel="noopener">Spitzer et al. — GAD-7 (2006)</a></li></ul></details></section>`;
 $('print-result').onclick=()=>window.print();focusStage('result-title');
}
function requestReset(){if(state.sending)return;$('reset-dialog').showModal();}
function reset(){state.screen='home';state.answers={};state.questions=[];state.mode='';state.index=0;state.error=false;state.sent=false;state.contact={name:'',phone:'',email:'',consent:false};$('reset-dialog').close();$('experience').hidden=true;$('home').hidden=false;$('stage').innerHTML='';$('escolher').scrollIntoView({behavior:'instant'});document.querySelector('[data-start]').focus({preventScroll:true});}
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>start(b.dataset.start));$('change-test').onclick=requestReset;$('cancel-reset').onclick=()=>$('reset-dialog').close();$('confirm-reset').onclick=reset;$('year').textContent=new Date().getFullYear();
