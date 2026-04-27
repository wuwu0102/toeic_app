
const STORAGE_KEY='toeic_v7_7_state';
const LEGACY_STORAGE_KEY='toeic_v7_1_state';
const PROGRESS_STORAGE_KEY='toeic_progress_v7_7';
const LEGACY_PROGRESS_STORAGE_KEY='toeic_progress_v1';
const SETTINGS_KEY='toeic_v7_7_settings';
const LEGACY_SETTINGS_KEY='toeic_v7_1_settings';
const DAILY_NEW=10,DAILY_MIN=20,DAILY_MAX=20,REVIEW_LIMIT=20,DAILY_MASTER_TARGET=2;
const APP_SCHEMA_VERSION=77;
const DEFAULT_PROGRESS_STATE={learnedWords:[],wrongWords:[],correctCount:0,wrongCount:0,lastStudyDate:'',dailyProgress:0,mode:'daily'};
const SM2_DEFAULTS={repetition:0,interval:0,efactor:2.5,dueDate:null,lastReviewedAt:null,lapseCount:0,correctCount:0,wrongCount:0,lastAskedAt:null};

function todayStr(){return new Date().toISOString().slice(0,10)}
function addDays(s,d){const x=new Date(s+'T00:00:00');x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function safeNumber(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function isoNow(){return new Date().toISOString()}
function masteryColor(m){if(m<=1)return'red';if(m<=3)return'yellow';return'green'}
function getLibraryWords(){return Array.isArray(window.WORDS)?window.WORDS:[]}
function getAppVersion(){return (window.APP_CONFIG&&window.APP_CONFIG.APP_VERSION)||'v7.9'}
function getAppName(){return (window.APP_CONFIG&&window.APP_CONFIG.APP_NAME)||'TOEIC v7.9 正式版'}
function getStudyWords(){return Object.values(state.words)}
function escapeRegExp(s){return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function getPrimaryMeaning(meaning){return String(meaning||'').split(/[；;、,，/]/).map(x=>x.trim()).find(Boolean)||'這個字'}
function getExampleSubject(w){const meaning=getPrimaryMeaning(w?.meaning);return /常用字$/.test(meaning)?`單字「${w.word}」`:`「${meaning}」`}
function getWordExample(w){return String(w?.example||w?.example_en||'').trim()}
function needsExampleZhRepair(w){const zh=String(w?.example_zh||'').trim();if(!zh)return true;const word=String(w?.word||'').trim();if(word&&new RegExp(`\\b${escapeRegExp(word)}\\b`,'i').test(zh))return true;const asciiLetters=(zh.match(/[A-Za-z]/g)||[]).length;return asciiLetters>=Math.max(4,Math.floor(zh.length*0.2))}
function hasReliableExample(w){return Boolean(getWordExample(w)&&String(w?.example_zh||'').trim())}
const EXAMPLE_ZH_PATTERNS=[
[/^The manager discussed the .+ during the meeting\.$/i,m=>`經理在會議中討論了${m}這個主題。`],
[/^The finance team reviewed the .+ before making payment\.$/i,m=>`財務團隊在付款前審查了${m}這項內容。`],
[/^The HR department mentioned .+ during the interview\.$/i,m=>`人資部門在面試過程中提到了${m}。`],
[/^Please check the .+ before your trip begins\.$/i,m=>`出發前請先確認${m}這項內容。`],
[/^We added .+ to tomorrow's agenda\.$/i,m=>`我們把${m}加入明天的議程。`],
[/^The campaign focused on .+ this quarter\.$/i,m=>`這一季的行銷活動聚焦於${m}。`],
[/^The warehouse updated the .+ before shipment\.$/i,m=>`出貨前，倉庫更新了${m}這項資料。`],
[/^I mentioned .+ in the email to the client\.$/i,m=>`我在寄給客戶的郵件中提到了${m}。`],
[/^The IT team tested the .+ before release\.$/i,m=>`資訊團隊在發布前測試了${m}這項內容。`],
[/^The sales team used .+ to close the deal\.$/i,m=>`業務團隊運用${m}完成了這筆交易。`],
];
function getExampleEn(w){if(!w)return'';const example=getWordExample(w);if(!example)return 'This entry currently has no verified example sentence.';return example}
function getExampleZh(w){if(!w)return'';const example=getWordExample(w);const zh=String(w?.example_zh||'').trim();if(!example||!zh)return '這個單字目前沒有可信的例句與翻譯，暫時不顯示錯誤內容。';if(!needsExampleZhRepair(w))return zh;const subject=getExampleSubject(w),en=example;for(const[p,render]of EXAMPLE_ZH_PATTERNS){if(p.test(en))return render(subject)}return `這句例句和${subject}有關。`}
function renderClickableSentence(sentence){return String(sentence||'').split(/(\s+|[.,!?])/).map(token=>/^[a-zA-Z]+$/.test(token)?`<span class="click-word" data-word="${token.toLowerCase()}">${token}</span>`:token).join('')}


// ===== v7.9 FINAL Word System =====

// ⭐ 本地字典（基本保底）
const BASE_DICT = {
  during: "在…期間",
  mattered: "重要；有關係",
  division: "部門",
  scheduling: "排班；排程",
  explained: "說明了",
  why: "為什麼",
  for: "為了；給",
  throughout: "整個期間",
  quarter: "季度",
  inventory: "庫存",
  control: "控管",
  service: "服務",
  audit: "稽核",
  preparation: "準備",
  vendor: "供應商",
  yesterday: "昨天",
  today: "今天",
  tomorrow: "明天",
  client: "客戶",
  customer: "顧客",
  sales: "業務",
  team: "團隊",
  meeting: "會議",
  schedule: "行程；排程",
  staff: "員工",
  company: "公司",
  manager: "主管",
  report: "報告",
  summary: "摘要",
  before: "在…之前",
  after: "在…之後",
  because: "因為",
  important: "重要的",
  information: "資訊"
};

// ⭐ 自動學習字典
const AUTO_DICT_KEY = "auto_dict_v1";

function loadAutoDict(){
  try{
    return JSON.parse(localStorage.getItem(AUTO_DICT_KEY)) || {};
  }catch{
    return {};
  }
}

function saveAutoDict(dict){
  localStorage.setItem(AUTO_DICT_KEY, JSON.stringify(dict));
}

let AUTO_DICT = loadAutoDict();

// ⭐ 安全 fetch（避免卡死）
async function safeFetch(url, options={}, timeout=1200){
  const controller = new AbortController();
  const id = setTimeout(()=>controller.abort(), timeout);

  try{
    const res = await fetch(url,{...options, signal:controller.signal});
    return res;
  }catch{
    return null;
  }finally{
    clearTimeout(id);
  }
}

// ⭐ 核心查詢（永遠有結果）
async function lookupWordMeaning(word){
  const w = String(word||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!w) return "（暫無翻譯）";

  // 1️⃣ 本地保底字典
  if(BASE_DICT[w]){
    return BASE_DICT[w];
  }

  // 2️⃣ 已學字典
  if(AUTO_DICT[w]){
    return AUTO_DICT[w];
  }

  // 3️⃣ API
  try{
    const res = await safeFetch(
      "https://floral-unit-6a80.chttwm.workers.dev/lookup-word",
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({word:w})
      }
    );

    if(res){
      const data = await res.json();

      if(data && data.meaning){
        AUTO_DICT[w] = data.meaning;
        saveAutoDict(AUTO_DICT);
        return data.meaning;
      }
    }

  }catch(e){
    console.log("lookup error", e);
  }

  // 4️⃣ fallback
  return "（暫無翻譯）";
}

// ⭐ Toast UI
function showToast(msg){
  let el = document.getElementById("toast-msg");

  if(!el){
    el = document.createElement("div");
    el.id = "toast-msg";
    el.style.position = "fixed";
    el.style.bottom = "100px";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.background = "black";
    el.style.color = "white";
    el.style.padding = "8px 12px";
    el.style.borderRadius = "8px";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }

  el.innerText = msg;
  el.style.display = "block";

  clearTimeout(el.timer);
  el.timer = setTimeout(()=>{
    el.style.display = "none";
  },1500);
}

// ⭐ 啟用點擊查詢
function enableWordClickMeaning(){
  const el = document.querySelector(".example-sentence");
  if(!el) return;

  const words = el.innerText.split(" ");

  el.innerHTML = words.map(w=>`<span class="click-word">${w}</span>`).join(" ");

  document.querySelectorAll(".click-word").forEach(span=>{
    span.onclick = async ()=>{
      const word = span.innerText;
      showToast(word); // 立即回應
      const meaning = await lookupWordMeaning(word);
      showToast(`${word}：${meaning}`);
    };
  });
}


function readSettings(){const raw=localStorage.getItem(SETTINGS_KEY)||localStorage.getItem(LEGACY_SETTINGS_KEY);const fb={apiBaseUrl:(window.APP_CONFIG&&window.APP_CONFIG.API_BASE_URL)||'',syncCode:''};if(!raw)return fb;try{const parsed={...fb,...JSON.parse(raw)};localStorage.setItem(SETTINGS_KEY,JSON.stringify(parsed));return parsed}catch{return fb}}
function writeSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
function getOrCreateSyncCode(){const s=readSettings();if(s.syncCode)return s.syncCode;s.syncCode='sync-'+Math.random().toString(36).slice(2,10)+'-'+Math.random().toString(36).slice(2,8);writeSettings(s);return s.syncCode}
function setSyncCode(v){v=(v||'').trim();if(!v)return false;const s=readSettings();s.syncCode=v;writeSettings(s);return true}

function getLibrarySignature(){const list=getLibraryWords();const count=list.length;const lastId=count?list[count-1].id:0;const lastWord=count?list[count-1].word:'';return `schema:${APP_SCHEMA_VERSION}|count:${count}|lastId:${lastId}|lastWord:${lastWord}`}
function normalizeWordEntry(w,index){
const id=Number(w?.id)||index+1;
const word=String(w?.word||'').trim().toLowerCase();
return {
id,word,
pos:String(w?.pos||'n.').trim()||'n.',
meaning:String(w?.meaning||'').trim()||word,
phonetic:String(w?.phonetic||'').trim(),
example:String(w?.example||'').trim(),
example_en:String(w?.example_en||'').trim(),
example_zh:String(w?.example_zh||'').trim(),
topic:String(w?.topic||'General').trim()||'General',
level:Number(w?.level)||2
}}
function ensureSm2Fields(word){
const now=todayStr();
word.repetition=Math.max(0,Math.floor(safeNumber(word.repetition,SM2_DEFAULTS.repetition)));
word.interval=Math.max(0,Math.floor(safeNumber(word.interval,SM2_DEFAULTS.interval)));
word.efactor=clamp(safeNumber(word.efactor,SM2_DEFAULTS.efactor),1.3,2.8);
word.dueDate=String(word.dueDate||word.nextReview||now);
word.lastReviewedAt=word.lastReviewedAt||word.lastReviewed||null;
word.lapseCount=Math.max(0,Math.floor(safeNumber(word.lapseCount,SM2_DEFAULTS.lapseCount)));
word.correctCount=Math.max(0,Math.floor(safeNumber(word.correctCount,SM2_DEFAULTS.correctCount)));
word.wrongCount=Math.max(0,Math.floor(safeNumber(word.wrongCount,SM2_DEFAULTS.wrongCount)));
word.lastAskedAt=word.lastAskedAt||null;
word.nextReview=word.dueDate;
return word
}
function makeFreshWordState(w,oldWord=null){
const merged={...w,mastery:oldWord?.mastery??0,seen:oldWord?.seen??false,wrongCount:oldWord?.wrongCount??0,learnedAt:oldWord?.learnedAt??null,lastReviewed:oldWord?.lastReviewed??null,nextReview:oldWord?.nextReview??null,reviewStep:oldWord?.reviewStep??0,todayScore:0,todayWrong:0,todayCorrect:0,repetition:oldWord?.repetition??SM2_DEFAULTS.repetition,interval:oldWord?.interval??SM2_DEFAULTS.interval,efactor:oldWord?.efactor??SM2_DEFAULTS.efactor,dueDate:oldWord?.dueDate??oldWord?.nextReview??todayStr(),lastReviewedAt:oldWord?.lastReviewedAt??oldWord?.lastReviewed??SM2_DEFAULTS.lastReviewedAt,lapseCount:oldWord?.lapseCount??SM2_DEFAULTS.lapseCount,correctCount:oldWord?.correctCount??SM2_DEFAULTS.correctCount,wrongCount:oldWord?.wrongCount??SM2_DEFAULTS.wrongCount,lastAskedAt:oldWord?.lastAskedAt??SM2_DEFAULTS.lastAskedAt};
return ensureSm2Fields(merged)
}
function buildInitialState(oldState=null){const oldById=oldState?.words||{};const oldByWord={};for(const item of Object.values(oldById)){if(item&&item.word)oldByWord[item.word]=item}const words={};const library=getLibraryWords().map((w,i)=>normalizeWordEntry(w,i));for(const w of library){const oldWord=oldById[w.id]&&oldById[w.id].word===w.word?oldById[w.id]:(oldByWord[w.word]||null);words[w.id]=makeFreshWordState(w,oldWord)}return {schemaVersion:APP_SCHEMA_VERSION,librarySignature:getLibrarySignature(),currentRoute:oldState?.currentRoute||'home',filters:oldState?.filters||{topic:'all',level:'all'},selectedWordId:null,words,sessions:{},history:oldState?.history||[],sync:oldState?.sync||{lastCloudLoad:null,lastCloudSave:null,cloudEnabled:false}}}
function saveLocalState(s){s.schemaVersion=APP_SCHEMA_VERSION;s.librarySignature=getLibrarySignature();localStorage.setItem(STORAGE_KEY,JSON.stringify(s))}
function loadLocalState(){const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY);if(raw){try{const parsed=JSON.parse(raw);const sameSchema=parsed?.schemaVersion===APP_SCHEMA_VERSION;const sameLibrary=parsed?.librarySignature===getLibrarySignature();if(sameSchema&&sameLibrary){localStorage.setItem(STORAGE_KEY,raw);return parsed}const rebuilt=buildInitialState(parsed);saveLocalState(rebuilt);return rebuilt}catch{}}const initial=buildInitialState();saveLocalState(initial);return initial}
function loadProgress(){try{const raw=localStorage.getItem(PROGRESS_STORAGE_KEY)||localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY);if(!raw)return {...DEFAULT_PROGRESS_STATE};const parsed=JSON.parse(raw);localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(parsed));return {...DEFAULT_PROGRESS_STATE,...parsed,learnedWords:Array.isArray(parsed?.learnedWords)?parsed.learnedWords:[],wrongWords:Array.isArray(parsed?.wrongWords)?parsed.wrongWords:[],mode:'daily'}}catch{return {...DEFAULT_PROGRESS_STATE}}}
let progressSaveTimer=null;
function saveProgress(){if(progressSaveTimer)clearTimeout(progressSaveTimer);progressSaveTimer=setTimeout(()=>{try{localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(progressState));console.log('AUTO SAVE OK')}catch{progressState={...DEFAULT_PROGRESS_STATE}}},300)}
function updateProgressAfterAnswer(w,ok){if(!w)return;const wordKey=String(w.word||'').trim().toLowerCase();if(!wordKey)return;progressState.lastStudyDate=todayStr();if(!progressState.learnedWords.includes(wordKey))progressState.learnedWords.push(wordKey);if(ok){progressState.correctCount+=1;progressState.wrongWords=progressState.wrongWords.filter(x=>x!==wordKey)}else{progressState.wrongCount+=1;if(!progressState.wrongWords.includes(wordKey))progressState.wrongWords.push(wordKey)}progressState.dailyProgress=getTodayMasteredCount();saveProgress()}

async function loadCloudStateIfPossible(){const settings=readSettings();const api=(settings.apiBaseUrl||'').trim().replace(/\/+$/,'');const syncCode=(settings.syncCode||'').trim();if(!api||!syncCode)return null;try{const res=await fetch(api+'/load?syncCode='+encodeURIComponent(syncCode));if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();if(data&&data.state){const merged=buildInitialState(data.state);merged.sync=merged.sync||{};merged.sync.lastCloudLoad=new Date().toISOString();merged.sync.cloudEnabled=true;return merged}return null}catch(err){console.error(err);return null}}
function showTooltip(el,text){const tooltip=document.getElementById('wordTooltip');if(!tooltip)return;tooltip.textContent=text;const rect=el.getBoundingClientRect();tooltip.style.top=(rect.top-40)+'px';tooltip.style.left=rect.left+'px';tooltip.style.display='block';clearTimeout(showTooltip.timer);showTooltip.timer=setTimeout(()=>{tooltip.style.display='none'},2000)}
showTooltip.timer=null;
const LOOKUP_DICTIONARY_KEY='toeic_lookup_dictionary_v1';
const WORD_LOOKUP_CACHE={};
function readLookupDictionary(){try{const raw=localStorage.getItem(LOOKUP_DICTIONARY_KEY);if(!raw)return{};const parsed=JSON.parse(raw);return parsed&&typeof parsed==='object'?parsed:{}}catch{return{}}}
function writeLookupDictionary(dict){try{localStorage.setItem(LOOKUP_DICTIONARY_KEY,JSON.stringify(dict||{}))}catch(e){console.warn('lookup dictionary save failed',e)}}
function getLookupMeaning(word){const dict=readLookupDictionary();const entry=dict?.[word];const meaning=String(entry?.meaning||'').trim();if(meaning){WORD_LOOKUP_CACHE[word]=meaning;return meaning}return''}
function saveLookupEntry(word,data){if(!data||typeof data!=='object')return;const meaning=String(data?.meaning||'').trim();if(!meaning)return;const dict=readLookupDictionary();dict[word]={word:String(data?.word||word).trim().toLowerCase()||word,meaning,pos:String(data?.pos||'').trim(),example:String(data?.example||'').trim(),example_zh:String(data?.example_zh||'').trim(),source:'ai'};writeLookupDictionary(dict);WORD_LOOKUP_CACHE[word]=meaning}
async function fetchWithTimeout(url,options={},timeoutMs=5000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
async function getWordMeaning(word){return lookupWordMeaning(word)}
function bindClickableWords(){document.querySelectorAll('.click-word').forEach(el=>{el.addEventListener('click',async()=>{const word=el.dataset.word;showTooltip(el,'查詢中...');const meaning=await lookupWordMeaning(word);showTooltip(el,meaning)})})}
let cloudSaveTimer=null,cloudSyncInFlight=false,cloudSyncRetryQueued=false,cloudSyncStatus='Synced';
function getCloudSyncConfig(){const settings=readSettings();const api=(settings.apiBaseUrl||'').trim().replace(/\/+$/,'');const syncCode=(settings.syncCode||'').trim();if(!api||!syncCode)return null;return {api,syncCode}}
function setCloudSyncStatus(status){cloudSyncStatus=status;const el=document.getElementById('cloudSyncStatus');if(el)el.textContent=status}
async function saveToCloud(data,silent=true,options={}){const cfg=getCloudSyncConfig();if(!cfg)return false;if(cloudSyncInFlight){if(!cloudSyncRetryQueued)cloudSyncRetryQueued=true;return false}cloudSyncInFlight=true;setCloudSyncStatus('Syncing...');try{const res=await fetch(cfg.api+'/save',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:options.keepalive===true,body:JSON.stringify({syncCode:cfg.syncCode,state:data})});if(!res.ok)throw new Error('HTTP '+res.status);const syncedAt=new Date().toISOString();if(window.state){window.state.sync=window.state.sync||{};window.state.sync.lastCloudSave=syncedAt;window.state.sync.lastSyncedAt=syncedAt;saveLocalState(window.state)}setCloudSyncStatus('Synced');if(window.state&&window.state.currentRoute==='settings')render();if(!silent)alert('已同步到雲端');return true}catch(err){console.error(err);setCloudSyncStatus('Sync failed');if(!silent)alert('同步失敗，請確認 Worker 網址是否正確');return false}finally{cloudSyncInFlight=false;if(cloudSyncRetryQueued){cloudSyncRetryQueued=false;saveToCloud(window.state||data,true)}}}
function scheduleAutoSync(){clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(()=>{if(!window.state)return;saveToCloud(window.state,true)},3000)}
function flushAutoSync(){if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null}if(window.state)saveToCloud(window.state,true,{keepalive:true})}
function saveState(s,opts={}){window.state=s;saveLocalState(s);if(opts.autoSync)scheduleAutoSync()}

function calcCardWeight(word,nowDate,recentSet=new Set()){
const dueDays=Math.floor((new Date(nowDate+'T00:00:00')-new Date((word.dueDate||nowDate)+'T00:00:00'))/86400000);
const dueWeight=dueDays>=0?80+dueDays*3:Math.max(0,20+dueDays);
const mistakeWeight=(word.lapseCount||0)*12+(word.wrongCount||0)*6+(word.todayWrong||0)*15;
const newWordWeight=word.repetition===0?18:0;
const recentPenalty=recentSet.has(word.id)?45:0;
const noise=Math.random()*8;
return dueWeight+mistakeWeight+newWordWeight-recentPenalty+noise
}
function scoreReviewPriority(word,today){
const isDue=(word.dueDate||word.nextReview||today)<=today?1:0;
return isDue*1000000+(safeNumber(word.wrongCount,0)*10000)+(safeNumber(word.lapseCount,0)*1000)+((10-safeNumber(word.mastery,0))*100)+((100-Math.min(100,safeNumber(word.interval,0)))*10)+Math.random()
}
function hasTargetWord(sentence,targetWord){
const target=String(targetWord||'').trim().toLowerCase();
if(!target)return true;
return new RegExp(`\\b${escapeRegExp(target)}\\b`,'i').test(String(sentence||''))
}
function isAwkwardExample(sentence,targetWord=''){
const text=String(sentence||'').trim();
if(!text)return true;
if(text.split(/\s+/).filter(Boolean).length>16)return true;
const lower=text.toLowerCase();
const suspicious=['linked','affect audit','service record','accurate abundance','without accurate'];
if(suspicious.some(x=>lower.includes(x)))return true;
if(targetWord&&!hasTargetWord(text,targetWord))return true;
const abstractHits=['synergy','framework','paradigm','optimization','enhancement'].filter(x=>lower.includes(x)).length;
return abstractHits>=2
}
function createDailyCandidateIds(){
const today=todayStr();const all=getStudyWords();
const freshPool=[...all].filter(w=>!w.seen||safeNumber(w.repetition,0)===0).sort((a,b)=>safeNumber(a.repetition,0)-safeNumber(b.repetition,0));
const reviewPool=[...all].filter(w=>w.seen||safeNumber(w.repetition,0)>0).sort((a,b)=>scoreReviewPriority(b,today)-scoreReviewPriority(a,today));
const weakPool=[...all].sort((a,b)=>scoreReviewPriority(b,today)-scoreReviewPriority(a,today));
const picked=[];const pickFrom=(list,limit)=>{for(const w of list){if(picked.length>=limit)break;if(!picked.includes(w.id))picked.push(w.id)}};
pickFrom(freshPool,DAILY_NEW);
if(picked.length<DAILY_NEW)pickFrom(reviewPool,DAILY_NEW);
pickFrom(reviewPool,DAILY_MAX);
if(picked.length<DAILY_MAX)pickFrom(freshPool,DAILY_MAX);
if(picked.length<DAILY_MAX)pickFrom(weakPool,DAILY_MAX);
return picked.slice(0,DAILY_MAX)
}
function getTodayMasteredCount(){const s=state?.sessions?.[todayStr()];if(!s)return 0;return s.activeIds.filter(id=>(state.words[id]?.todayScore||0)>=DAILY_MASTER_TARGET).length}
function getTodayCompletedCount(session){if(!session)return 0;const done=new Set([...(session.completedCards||[]),...(session.completedQuiz||[])]);return Math.min(session.activeIds.length,done.size)}
function pickFreePracticeIds(){const wrongIds=progressState.wrongWords.map(word=>Object.values(state.words).find(w=>w.word.toLowerCase()===word)?.id).filter(Boolean);if(wrongIds.length)return shuffle([...new Set(wrongIds)]).slice(0,Math.max(5,Math.min(DAILY_NEW,wrongIds.length)));const allIds=Object.values(state.words).map(w=>w.id);return shuffle(allIds).slice(0,DAILY_NEW)}
function continueFreePractice(){const s=ensureTodaySession();for(const id of s.activeIds){const w=state.words[id];w.todayScore=0;w.todayWrong=0;w.todayCorrect=0}s.stage='quiz';s.mode='daily';s.quizMode='practice';s.cardIndex=s.activeIds.length;s.completedQuiz=[];s.recentQuizIds=[];s.wrongIds=[];s.stats.correct=0;s.stats.wrong=0;progressState.mode='daily';progressState.dailyProgress=getTodayMasteredCount();saveState(state,{autoSync:true});saveProgress();go('quiz')}
function ensureTodaySession(){const t=todayStr();if(state.sessions[t]){state.sessions[t].mode='daily';state.sessions[t].quizMode='practice';state.sessions[t].recentQuizIds=Array.isArray(state.sessions[t].recentQuizIds)?state.sessions[t].recentQuizIds:[];return state.sessions[t]}const ids=createDailyCandidateIds();for(const id of ids){const w=state.words[id];w.todayScore=0;w.todayWrong=0;w.todayCorrect=0}const s={date:t,activeIds:ids,stage:'cards',mode:'daily',quizMode:'practice',cardIndex:0,completedCards:[],completedQuiz:[],wrongIds:[],recentQuizIds:[],stats:{green:0,yellow:0,red:0,correct:0,wrong:0}};state.sessions[t]=s;saveState(state,{autoSync:true});return s}
function libraryDone(all){const unseen=all.filter(w=>!w.seen).length;const due=all.filter(w=>w.nextReview&&w.nextReview<=todayStr()).length;return unseen===0&&due===0}
function getUnmasteredCount(session){return session.activeIds.filter(id=>(state.words[id].todayScore||0)<DAILY_MASTER_TARGET).length}
function pickNextQuizId(session){
const arr=session.activeIds.filter(id=>(state.words[id].todayScore||0)<DAILY_MASTER_TARGET);
if(arr.length===0)return null;
const recentSet=new Set((session.recentQuizIds||[]).slice(-2));
arr.sort((a,b)=>{
const wa=state.words[a],wb=state.words[b];
const pa=calcCardWeight(wa,todayStr(),recentSet)+(wa.todayWrong||0)*12+(DAILY_MASTER_TARGET-(wa.todayScore||0))*8;
const pb=calcCardWeight(wb,todayStr(),recentSet)+(wb.todayWrong||0)*12+(DAILY_MASTER_TARGET-(wb.todayScore||0))*8;
return pb-pa
});
const filtered=arr.filter(id=>!recentSet.has(id));
const pool=(filtered.length?filtered:arr).slice(0,Math.min(8,arr.length));
return pool[Math.floor(Math.random()*pool.length)]
}
function speakWord(text){if(!('speechSynthesis' in window)){alert('這個瀏覽器不支援發音');return}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.92;window.speechSynthesis.speak(u)}
function speak(text){if(!window.speechSynthesis){console.warn('TTS not supported');return}const utter=new SpeechSynthesisUtterance(text);utter.lang='en-US';utter.rate=0.9;utter.pitch=1;window.speechSynthesis.speak(utter)}
function bindSentenceTTS(currentWord){const btn=document.getElementById('playSentence');if(!btn)return;btn.onclick=()=>{speak(getWordExample(currentWord))}}
function updateSm2(word,quality){
ensureSm2Fields(word);
const now=todayStr();
word.lastReviewed=now;
word.lastReviewedAt=isoNow();
if(quality<3){
word.repetition=0;
word.interval=1;
word.efactor=clamp(word.efactor-0.2,1.3,2.8);
word.lapseCount+=1;
word.wrongCount+=1;
}else{
word.repetition+=1;
if(word.repetition===1)word.interval=1;
else if(word.repetition===2)word.interval=6;
else word.interval=Math.max(1,Math.round(word.interval*word.efactor));
const q=quality;
word.efactor=clamp(word.efactor+(0.1-(5-q)*(0.08+(5-q)*0.02)),1.3,2.8);
word.correctCount+=1;
}
word.dueDate=addDays(now,word.interval);
word.nextReview=word.dueDate;
word.reviewStep=word.repetition;
}
function scheduleByCard(word,grade){const quality=grade==='green'?5:grade==='yellow'?4:2;if(!word.seen){word.seen=true;word.learnedAt=todayStr()}updateSm2(word,quality);if(quality<3)word.mastery=Math.max(0,word.mastery-1);else if(quality===4)word.mastery=Math.min(5,Math.max(1,word.mastery+1));else word.mastery=Math.min(5,word.mastery+2)}
function scheduleByQuiz(word,ok){if(ok){word.todayCorrect+=1;word.todayScore=Math.min(DAILY_MASTER_TARGET,word.todayScore+1);updateSm2(word,5);word.mastery=Math.min(5,word.mastery+1)}else{word.todayWrong+=1;word.todayScore=0;updateSm2(word,2);word.mastery=Math.max(0,word.mastery-1)}}
function getMasteryStage(word){if((word.repetition||0)===0)return'新字';if(word.repetition<=2)return'學習中';if((word.interval||0)>=21)return'熟練';return'複習中'}
function formatDateSafe(s){if(!s)return'尚未安排';const d=new Date(s.length===10?`${s}T00:00:00`:s);if(Number.isNaN(d.getTime()))return'尚未安排';return d.toISOString().slice(0,16).replace('T',' ')}
function finalizeSessionIfNeeded(){const t=todayStr(),s=state.sessions[t];if(!s||s.stage!=='done')return;const exists=(state.history||[]).some(x=>x.date===t);if(!exists){state.history.unshift({date:t,total:s.activeIds.length,correct:s.stats.correct,wrong:s.stats.wrong});if(state.history.length>30)state.history=state.history.slice(0,30);saveState(state,{autoSync:true})}}
function setTitle(title,showHome){document.getElementById('title').textContent=title;document.getElementById('homeBtn').classList.toggle('hidden',!showHome);const v=getAppVersion();const versionTag=document.getElementById('versionTag');const versionBadge=document.getElementById('versionBadge');if(versionTag)versionTag.textContent=v;if(versionBadge)versionBadge.textContent=v}
function applyAppIdentity(){document.title=getAppName();const v=getAppVersion();const versionTag=document.getElementById('versionTag');const versionBadge=document.getElementById('versionBadge');if(versionTag)versionTag.textContent=v;if(versionBadge)versionBadge.textContent=v}
function setNav(route){document.querySelectorAll('.navbtn').forEach(btn=>btn.classList.toggle('active',btn.dataset.route===route))}
function go(route){state.currentRoute=route;saveState(state);render()}
function openWordDetail(id){state.selectedWordId=id;state.currentRoute='word';saveState(state);render()}
document.getElementById('homeBtn').addEventListener('click',()=>go('home'))
document.querySelectorAll('.navbtn').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.route)))

function renderHome(){const s=ensureTodaySession();setTitle('今日任務',false);setNav('home');const total=s.activeIds.length,remain=getUnmasteredCount(s),done=total-remain,completed=getTodayCompletedCount(s),completionPercent=total?Math.floor((completed/total)*100):100,p=total?Math.round(done/total*100):0;const all=getStudyWords(),learned=all.filter(w=>w.seen).length,finished=libraryDone(all);document.getElementById('view').innerHTML=`${finished?`<div class="card notice"><div class="section">目前字庫已練完</div><div class="muted">可以直接換新的 words_library.js。</div></div>`:''}<div class="card hero"><div class="small">穩定版：單字庫獨立成單檔，可直接抽換</div><div class="section">今日未熟 ${remain} / ${total}</div><div class="track"><div class="bar" style="width:${p}%"></div></div><div style="height:8px"></div><div class="section" style="font-size:20px;margin-top:8px">${completionPercent===100?'今日任務已完成 100%':`今日完成度 ${completionPercent}%`}</div><div class="track"><div class="bar" style="width:${completionPercent}%"></div></div><div class="small" style="margin-top:8px">已完成 ${completed} / ${total||0}</div>${completionPercent===100?'<div class="pill" style="margin-top:8px">今天進度已完成</div>':''}<div style="height:8px"></div><div class="pill">熟練條件：每字至少答對 2 次</div><div class="stack" style="margin-top:14px"><button class="btn primary" id="startBtn" type="button">${done>0?'繼續今日練習':'開始今日練習'}</button></div></div><div class="grid"><div class="metric"><div class="ml">今天字數</div><div class="mv">${total}</div></div><div class="metric"><div class="ml">剩餘未熟</div><div class="mv">${remain}</div></div><div class="metric"><div class="ml">已學過</div><div class="mv">${learned}</div></div><div class="metric"><div class="ml">正式字庫</div><div class="mv">${all.length}</div></div></div>`;document.getElementById('startBtn').addEventListener('click',()=>{if(s.stage==='cards')go('study');else if(s.stage==='quiz')go('quiz');else continueFreePractice()})}
function renderStudy(){const s=ensureTodaySession();setTitle('單字卡',true);setNav('');const total=s.activeIds.length;if(s.cardIndex>=total){s.stage='quiz';saveState(state,{autoSync:true});go('quiz');return}const id=s.activeIds[s.cardIndex],w=state.words[id];if(w.showLongExample===undefined){w.showLongExample=false}w.example_short=String(w.example_short||w.example||w.example_en||'').trim();w.example_long=String(w.example_long||w.example||w.example_en||w.example_short||'').trim();w.example_zh_short=String(w.example_zh_short||w.example_zh||'').trim();w.example_zh_long=String(w.example_zh_long||w.example_zh||w.example_zh_short||'').trim();const exampleEn=w.showLongExample?w.example_long:w.example_short;const exampleZh=w.showLongExample?w.example_zh_long:w.example_zh_short;document.getElementById('view').innerHTML=`<div class="card hero"><div class="small">第 ${s.cardIndex+1} / ${total} 張</div><div class="track"><div class="bar" style="width:${Math.round(s.cardIndex/total*100)}%"></div></div></div><div class="card"><div class="word">${w.word}</div><div class="phon">${w.phonetic}</div><div class="meta"><span class="badge">${w.pos}</span><span class="badge">${w.topic}</span><span class="badge">L${w.level}</span></div><div class="meaning">${w.meaning}</div><div class="stack" style="margin-top:12px"><button class="btn secondary" id="speakBtn" type="button">🔊 聽發音</button><button class="btn secondary" id="playSentence" type="button">🔊 聽例句</button></div><div class="exen example-sentence">${renderClickableSentence(exampleEn||getExampleEn(w))}</div><div class="exzh">${exampleZh||getExampleZh(w)}</div><div class="stack" style="margin-top:10px"><button class="btn secondary" id="regenStudyExampleBtn" type="button">🔄 換一句 / 看正式句</button></div><div class="answers"><button class="btn red" data-grade="red" type="button">不會</button><button class="btn yellow" data-grade="yellow" type="button">模糊</button><button class="btn green" data-grade="green" type="button">記得</button></div></div>`;document.getElementById('speakBtn').addEventListener('click',()=>speakWord(w.word));bindSentenceTTS(w);bindClickableWords();setTimeout(enableWordClickMeaning,0);const regenStudyBtn=document.getElementById('regenStudyExampleBtn');if(regenStudyBtn){regenStudyBtn.addEventListener('click',async()=>{if(!w.showLongExample){w.showLongExample=true;render();return}const oldText=regenStudyBtn.textContent;regenStudyBtn.disabled=true;regenStudyBtn.textContent='生成中...';try{await regenerateExampleAI(w);w.showLongExample=false}finally{const btn=document.getElementById('regenStudyExampleBtn');if(btn){btn.disabled=false;btn.textContent=oldText}}})}document.querySelectorAll('[data-grade]').forEach(btn=>btn.addEventListener('click',()=>{const g=btn.dataset.grade;scheduleByCard(w,g);updateProgressAfterAnswer(w,g!=='red');if(!s.completedCards.includes(id))s.completedCards.push(id);s.stats[g]+=1;s.cardIndex+=1;saveState(state,{autoSync:true});saveProgress();renderStudy()}))}
function makeQuestionSentence(w){const sentence=getWordExample(w);if(!sentence)return 'Please choose the correct word: _____';const lowerSentence=sentence.toLowerCase();const lowerWord=(w.word||'').toLowerCase();const idx=lowerSentence.indexOf(lowerWord);if(idx===-1)return 'Please choose the correct word: _____';return sentence.slice(0,idx)+'_____'+sentence.slice(idx+w.word.length)}
function renderQuiz(){const s=ensureTodaySession();setTitle('熟練練習',true);setNav('');const nextId=pickNextQuizId(s);if(nextId==null){s.stage='done';s.mode='daily';progressState.mode='daily';progressState.dailyProgress=getTodayMasteredCount();saveState(state,{autoSync:true});saveProgress();finalizeSessionIfNeeded();go('summary');return}const w=state.words[nextId],remain=getUnmasteredCount(s),masked=makeQuestionSentence(w),exampleZh=getExampleZh(w);state.currentQuizWordId=nextId;document.getElementById('view').innerHTML=`<div class="card hero"><div class="small">今天剩餘未熟 ${remain} 題</div><div class="track"><div class="bar" style="width:${Math.round((s.activeIds.length-remain)/s.activeIds.length*100)}%"></div></div></div><div class="card quiz"><div class="exen example-sentence">${renderClickableSentence(masked)}</div><div class="meta">${w.pos} ｜ 中文已隱藏</div><button class="btn secondary" id="speakBtn" type="button">🔊 聽發音</button><input id="answerInput" class="input" placeholder="輸入英文單字" autocomplete="off" autocapitalize="none" spellcheck="false"><div class="stack" style="margin-top:10px"><button class="btn primary" id="checkBtn" type="button">確認答案</button></div><div id="resultBox"></div></div>`;document.getElementById('speakBtn').addEventListener('click',()=>speakWord(w.word));const speakBtn=document.getElementById('speakBtn');if(speakBtn){speakBtn.insertAdjacentHTML('afterend','<button id="regenExampleBtn" style="margin-top:8px;">🔄 換一句</button><div id="quizExampleEn" class="exen example-sentence" style="margin-top:8px;">'+renderClickableSentence(masked)+'</div><div id="quizExampleZh" class="exzh">'+exampleZh+'</div>')}bindClickableWords();setTimeout(enableWordClickMeaning,0);const input=document.getElementById('answerInput');input.focus();function nextStep(){if(!s.completedQuiz.includes(nextId))s.completedQuiz.push(nextId);s.recentQuizIds=[...(s.recentQuizIds||[]),nextId].slice(-4);state.words[nextId].lastAskedAt=isoNow();saveState(state,{autoSync:true});saveProgress();renderQuiz();window.scrollTo({top:0,behavior:'instant'})}function showResult(ok){const box=document.getElementById('resultBox');if(ok){s.stats.correct+=1;box.innerHTML=`<div class="result good"><div><strong>答對了</strong></div><div style="margin-top:4px">${w.word}</div><div style="margin-top:4px">${w.meaning||'—'}</div><div class="muted" style="margin-top:4px">${exampleZh}</div><div class="muted" style="margin-top:4px">今日熟練進度：${w.todayScore}/${DAILY_MASTER_TARGET}</div></div><div class="stack" style="margin-top:10px"><button class="btn primary" id="nextBtn" type="button">下一題</button></div>`}else{s.stats.wrong+=1;if(!s.wrongIds.includes(nextId))s.wrongIds.push(nextId);box.innerHTML=`<div class="result bad"><div><strong>答錯了</strong></div><div style="margin-top:4px">正確答案：<strong>${w.word}</strong></div><div style="margin-top:4px">${w.meaning||'—'}</div><div class="muted" style="margin-top:4px">${exampleZh}</div><div class="muted" style="margin-top:4px">這個單字今天會再次出現，直到熟練。</div></div><div class="stack" style="margin-top:10px"><button class="btn primary" id="nextBtn" type="button">繼續練習</button></div>`}document.getElementById('nextBtn').addEventListener('click',nextStep)}function check(){const answer=input.value.trim().toLowerCase(),correct=w.word.toLowerCase(),ok=answer===correct;scheduleByQuiz(w,ok);updateProgressAfterAnswer(w,ok);document.getElementById('checkBtn').disabled=true;input.disabled=true;showResult(ok);saveState(state,{autoSync:true});saveProgress()}document.getElementById('checkBtn').addEventListener('click',check);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!document.getElementById('checkBtn').disabled)check()});const regenBtn=document.getElementById("regenExampleBtn");if(regenBtn){regenBtn.onclick=async()=>{await regenerateExampleForQuiz();}}}
function renderSummary(){const s=ensureTodaySession();finalizeSessionIfNeeded();setTitle('今日完成',true);setNav('');const total=s.activeIds.length,acc=(s.stats.correct+s.stats.wrong)?Math.round(s.stats.correct/(s.stats.correct+s.stats.wrong)*100):0,wrongList=s.wrongIds.map(id=>state.words[id]);document.getElementById('view').innerHTML=`<div class="card hero" style="text-align:center"><div class="small">已達今日目標，可自由練習</div><div class="section">${total} / ${total}</div><div class="meaning">作答正確率 ${acc}%</div></div><div class="grid"><div class="metric"><div class="ml">綠燈</div><div class="mv">${s.stats.green}</div></div><div class="metric"><div class="ml">黃燈</div><div class="mv">${s.stats.yellow}</div></div><div class="metric"><div class="ml">紅燈</div><div class="mv">${s.stats.red}</div></div><div class="metric"><div class="ml">答對次數</div><div class="mv">${s.stats.correct}</div></div></div><div class="card"><div class="section">今天錯過的單字</div>${wrongList.length?wrongList.map(w=>`<div class="kv"><span>${w.word}</span><span class="muted">${w.meaning}</span></div>`).join(''):'<div class="muted">今天沒有錯字</div>'}</div><div class="stack"><button class="btn primary" id="continueBtn" type="button">繼續今日練習</button><button class="btn secondary" id="backHomeBtn" type="button">回首頁</button></div>`;document.getElementById('continueBtn').addEventListener('click',continueFreePractice);document.getElementById('backHomeBtn').addEventListener('click',()=>go('home'))}
function getCurrentWord(){const id=state.currentQuizWordId;return id==null?null:state.words[id]}
function parseGeneratedExamplePayload(payload){
const content=typeof payload==='string'?payload:String(payload?.choices?.[0]?.message?.content||'');
let parsed=null;
try{parsed=JSON.parse(content)}catch{const m=content.match(/\{[\s\S]*\}/);if(m){try{parsed=JSON.parse(m[0])}catch{parsed=null}}}
if(parsed&&typeof parsed==='object'){const short=String(parsed.short||'').trim(),long=String(parsed.long||'').trim(),zhShort=String(parsed.zh_short||'').trim(),zhLong=String(parsed.zh_long||'').trim();if(short||long||zhShort||zhLong)return{short,long,zh_short:zhShort,zh_long:zhLong}}
const enMatch=content.match(/EN:\s*([\s\S]*?)\r?\nZH:/);
const zhMatch=content.match(/ZH:\s*([\s\S]*)$/);
if(enMatch||zhMatch){const en=String(enMatch?.[1]||'').trim(),zh=String(zhMatch?.[1]||'').trim();return{short:en,long:en,zh_short:zh,zh_long:zh}}
return null
}
async function regenerateExampleForQuiz(){
try{
const word=getCurrentWord&&getCurrentWord();
if(!word||!word.word)return;
const btn=document.getElementById('regenExampleBtn');
if(btn)btn.innerText='生成中...';
const res=await fetch((window.APP_CONFIG?.API_BASE_URL||'')+'/generate-example',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:word.word})});
const data=await res.json();
const parsed=parseGeneratedExamplePayload(data);
if(!parsed)throw new Error('format error');
const originalExample=String(word.example||'').trim();
const originalZh=String(word.example_zh||'').trim();
const en=String(parsed.short||parsed.long||'').trim()||originalExample;
const zhCandidate=String(parsed.zh_short||parsed.zh_long||'').trim();
const zh=zhCandidate||originalZh;
if(isAwkwardExample(en,word.word))console.warn('[awkward-example]',{word:word.word,en});
word.example_short=parsed.short||word.example;
word.example_long=parsed.long||word.example;
word.example_zh_short=parsed.zh_short||word.example_zh;
word.example_zh_long=parsed.zh_long||word.example_zh;
word.example=en;
word.exampleZh=zh;
word.example_zh=zh;
const enEl=document.querySelector('#quizExampleEn');
const zhEl=document.querySelector('#quizExampleZh');
if(enEl)enEl.innerHTML=renderClickableSentence(en);
if(zhEl)zhEl.innerText=zh;
bindClickableWords();
setTimeout(enableWordClickMeaning,0);
if(typeof saveState==='function'){
saveState(state,{autoSync:true});
}
}catch(e){
console.warn('regen example failed',e);
}finally{
const btn=document.getElementById('regenExampleBtn');
if(btn)btn.innerText='🔄 換一句';
}
}

async function regenerateExampleAI(wordObj){
try{
const settings=readSettings();
const api=(settings.apiBaseUrl||'').trim().replace(/\/+$/,'');
if(!api){alert('請先在設定頁填入雲端 API 網址');return}
if(!wordObj||!wordObj.word){alert('找不到目前單字');return}
const originalExample=wordObj.example;
const originalExampleZh=wordObj.example_zh;
const res=await fetch(api+'/generate-example',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:wordObj.word})});
if(!res.ok)throw new Error('HTTP '+res.status);
const data=await res.json();
const parsed=parseGeneratedExamplePayload(data);
if(!parsed){wordObj.example=originalExample;wordObj.example_zh=originalExampleZh;alert('AI 回傳格式錯誤');return}
const nextExample=String(parsed.short||parsed.long||'').trim();
const nextZh=String(parsed.zh_short||parsed.zh_long||'').trim();
if(!nextExample){wordObj.example=originalExample;wordObj.example_zh=originalExampleZh;alert('AI 回傳格式錯誤');return}
wordObj.example_short=nextExample||wordObj.example;
wordObj.example_long=String(parsed.long||nextExample||wordObj.example).trim();
wordObj.example_zh_short=nextZh||wordObj.example_zh;
wordObj.example_zh_long=String(parsed.zh_long||nextZh||wordObj.example_zh).trim();
wordObj.example=wordObj.example_short;
if(nextZh)wordObj.example_zh=wordObj.example_zh_short;
wordObj.showLongExample=false;
if(isAwkwardExample(wordObj.example,wordObj.word))console.warn('[awkward-example]',{word:wordObj.word,en:wordObj.example});
if(!wordObj.example||!String(wordObj.example_zh||'').trim()){wordObj.example=originalExample;wordObj.example_zh=originalExampleZh;alert('AI 沒有產生完整例句');return}
saveState(state,{autoSync:true});
saveProgress();
render();
}catch(e){
console.error('regenerateExampleAI failed:',e);
alert('生成失敗');
}
}

function renderWordDetail(){const w=state.words[state.selectedWordId];if(!w){go('list');return}ensureSm2Fields(w);const exampleEn=getExampleEn(w),exampleZh=getExampleZh(w),totalAnswers=(w.correctCount||0)+(w.wrongCount||0),accuracy=totalAnswers?Math.floor((w.correctCount/totalAnswers)*100):0;setTitle('單字詳情',true);setNav('');document.getElementById('view').innerHTML=`<div class="card"><div class="word">${w.word}</div><div class="phon">${w.phonetic}</div><div class="meta"><span class="badge">${w.pos}</span><span class="badge">${w.topic}</span><span class="badge">L${w.level}</span></div><div class="meaning">${w.meaning}</div><div class="stack" style="margin-top:12px"><button class="btn secondary" id="speakBtn" type="button">🔊 聽發音</button></div><div class="section" style="font-size:18px;margin-top:16px">英文例句</div><div class="stack" style="margin-top:8px"><button id="playSentence" class="btn secondary" type="button">🔊 聽例句</button></div><div class="exen">${exampleEn}</div><div class="section" style="font-size:18px;margin-top:16px">中文例句</div><div class="exzh">${exampleZh}</div><div class="stack" style="margin-top:10px"><button class="btn primary" id="regenBtn" type="button">🔁 重生例句</button></div><div class="section" style="font-size:18px;margin-top:16px">熟練度</div><div class="kv"><span>目前燈號</span><span class="dot ${masteryColor(w.mastery)}"></span></div><div class="kv"><span>熟練階段</span><span>${getMasteryStage(w)}</span></div><div class="kv"><span>已學過</span><span>${w.seen?'是':'否'}</span></div><div class="kv"><span>下次複習時間</span><span>${formatDateSafe(w.dueDate||w.nextReview)}</span></div><div class="kv"><span>累積答對</span><span>${w.correctCount||0}</span></div><div class="kv"><span>累積答錯</span><span>${w.wrongCount||0}</span></div><div class="kv"><span>正確率</span><span>${accuracy}%</span></div><div class="stack" style="margin-top:16px"><button class="btn primary" id="backListBtn" type="button">回單字庫</button></div></div>`;document.getElementById('speakBtn').addEventListener('click',()=>speakWord(w.word));bindSentenceTTS(w);const regenBtn=document.getElementById('regenBtn');if(regenBtn){regenBtn.addEventListener('click',async()=>{const currentBtn=regenBtn;const oldText=currentBtn.textContent;currentBtn.disabled=true;currentBtn.textContent='重生中...';try{const selected=state.words[state.selectedWordId];await regenerateExampleAI(selected)}finally{const btn=document.getElementById('regenBtn');if(btn){btn.disabled=false;btn.textContent=oldText}}})}document.getElementById('backListBtn').addEventListener('click',()=>go('list'))}
function renderList(){setTitle('單字庫',false);setNav('list');const all=getStudyWords(),topics=['all',...new Set(all.map(w=>w.topic))],topicFilter=state.filters.topic||'all',levelFilter=state.filters.level||'all';const filtered=all.filter(w=>topicFilter==='all'||w.topic===topicFilter).filter(w=>levelFilter==='all'||String(w.level)===levelFilter).sort((a,b)=>a.word.localeCompare(b.word));const topicOptions=topics.map(t=>`<option value="${t}" ${t===topicFilter?'selected':''}>${t==='all'?'全部主題':t}</option>`).join('');const levelOptions=['all','1','2','3'].map(l=>`<option value="${l}" ${l===levelFilter?'selected':''}>${l==='all'?'全部等級':'Level '+l}</option>`).join('');const rows=filtered.map(w=>`<div class="row word-row" data-id="${w.id}" role="button"><span class="dot ${masteryColor(w.mastery)}"></span><div><div class="wsmall">${w.word}</div><div class="muted">${w.pos} ｜ ${w.meaning}</div></div><button class="ghost speak-only" data-speak="${w.word}" type="button">🔊</button></div>`).join('');document.getElementById('view').innerHTML=`<div class="card notice"><div class="small">字庫已獨立成 words_library.js，之後你只要抽換那個檔案就能換整套單字。</div></div><div class="filter"><select id="topicFilter" class="select">${topicOptions}</select><select id="levelFilter" class="select">${levelOptions}</select></div><div class="card"><div class="small">共 ${filtered.length} 個正式單字</div>${rows}</div>`;document.getElementById('topicFilter').addEventListener('change',e=>{state.filters.topic=e.target.value;saveState(state);renderList()});document.getElementById('levelFilter').addEventListener('change',e=>{state.filters.level=e.target.value;saveState(state);renderList()});document.querySelectorAll('.word-row').forEach(el=>el.addEventListener('click',()=>openWordDetail(Number(el.dataset.id))));document.querySelectorAll('.speak-only').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();speakWord(btn.dataset.speak)}))}
function renderStats(){setTitle('學習統計',false);setNav('stats');const all=getStudyWords(),learned=all.filter(w=>w.seen).length,dueToday=all.filter(w=>w.nextReview&&w.nextReview<=todayStr()).length,historyRows=(state.history||[]).slice(0,7).map(h=>`<div class="kv"><span>${h.date}</span><span class="muted">${h.correct}/${h.total}</span></div>`).join('');document.getElementById('view').innerHTML=`<div class="grid"><div class="metric"><div class="ml">已學過</div><div class="mv">${learned}</div></div><div class="metric"><div class="ml">今日到期複習</div><div class="mv">${dueToday}</div></div><div class="metric"><div class="ml">最近完成</div><div class="mv">${(state.history||[]).length}</div></div><div class="metric"><div class="ml">正式字庫</div><div class="mv">${all.length}</div></div></div><div class="card"><div class="section">最近學習紀錄</div>${historyRows||'<div class="muted">還沒有完成的紀錄</div>'}</div>`}
function renderSettings(){setTitle('設定',false);setNav('settings');const settings=readSettings(),cloudReady=(settings.apiBaseUrl||'').trim()?'已設定':'未設定',syncCode=getOrCreateSyncCode();document.getElementById('view').innerHTML=`<div class="card"><div class="section">版本資訊</div><div class="kv"><span>版次</span><span>${getAppVersion()}</span></div><div class="kv"><span>正式字庫</span><span>${getStudyWords().length}</span></div><div class="kv"><span>同步代碼</span><span class="mono">${syncCode}</span></div><div class="kv"><span>雲端 API</span><span>${cloudReady}</span></div><div class="kv"><span>最後雲端讀取</span><span class="muted">${state.sync&&state.sync.lastCloudLoad?state.sync.lastCloudLoad.slice(0,19).replace('T',' '):'尚未'}</span></div><div class="kv"><span>最後雲端保存</span><span class="muted">${state.sync&&state.sync.lastCloudSave?state.sync.lastCloudSave.slice(0,19).replace('T',' '):'尚未'}</span></div><div class="kv"><span>最後同步時間</span><span class="muted">${state.sync&&state.sync.lastSyncedAt?state.sync.lastSyncedAt.slice(0,19).replace('T',' '):'尚未'}</span></div></div><div class="card"><div class="section">雲端同步設定</div><div class="muted">換手機時，用同一個 Worker API 與同步代碼即可載回進度。</div><input id="apiInput" class="input" placeholder="貼上 Worker API 網址" value="${settings.apiBaseUrl||''}"><input id="syncCodeInput" class="input mono" placeholder="輸入或貼上同步代碼" value="${syncCode}"><div class="stack"><button class="btn primary" id="saveApiBtn" type="button">保存同步設定</button><button class="btn secondary" id="syncNowBtn" type="button">立刻同步到雲端</button><button class="btn secondary" id="loadCloudBtn" type="button">從雲端載入進度</button><button class="btn light" id="copyCodeBtn" type="button">複製同步代碼</button></div></div>`;document.getElementById('saveApiBtn').addEventListener('click',()=>{const api=document.getElementById('apiInput').value.trim(),code=document.getElementById('syncCodeInput').value.trim();if(!code){alert('請先輸入同步代碼');return}const s=readSettings();s.apiBaseUrl=api;s.syncCode=code;writeSettings(s);alert('同步設定已保存');render()});document.getElementById('syncNowBtn').addEventListener('click',async()=>{const code=document.getElementById('syncCodeInput').value.trim();if(!setSyncCode(code)){alert('請先輸入同步代碼');return}await saveToCloud(state,false)});document.getElementById('loadCloudBtn').addEventListener('click',async()=>{const code=document.getElementById('syncCodeInput').value.trim();if(!setSyncCode(code)){alert('請先輸入同步代碼');return}const cloud=await loadCloudStateIfPossible();if(cloud){state=cloud;saveLocalState(state);alert('已從雲端載入進度');render()}else{alert('讀取失敗，請確認 Worker 網址、同步代碼或雲端資料')}});document.getElementById('copyCodeBtn').addEventListener('click',async()=>{const code=document.getElementById('syncCodeInput').value.trim();try{await navigator.clipboard.writeText(code);alert('同步代碼已複製')}catch{alert('複製失敗，請手動複製')}})}
function render(){setCloudSyncStatus(cloudSyncStatus);const route=state.currentRoute||'home';if(route==='home')return renderHome();if(route==='study')return renderStudy();if(route==='quiz')return renderQuiz();if(route==='summary')return renderSummary();if(route==='list')return renderList();if(route==='stats')return renderStats();if(route==='settings')return renderSettings();if(route==='word')return renderWordDetail();renderHome()}
window.addEventListener('pagehide',flushAutoSync);window.addEventListener('beforeunload',flushAutoSync);window.speakWord=speakWord;
let state=loadLocalState();
let progressState=loadProgress();
function hydrateProgressState(){const all=getStudyWords();const learnedWords=all.filter(w=>w.seen).map(w=>w.word.toLowerCase());if(!progressState.learnedWords.length)progressState.learnedWords=learnedWords;progressState.correctCount=Math.max(progressState.correctCount,(state.history||[]).reduce((sum,h)=>sum+(Number(h.correct)||0),0));progressState.wrongCount=Math.max(progressState.wrongCount,(state.history||[]).reduce((sum,h)=>sum+(Number(h.wrong)||0),0));progressState.mode='daily';progressState.dailyProgress=getTodayMasteredCount();saveProgress()}
(async()=>{applyAppIdentity();const cloud=await loadCloudStateIfPossible();if(cloud){state=cloud;saveLocalState(state)}ensureTodaySession();finalizeSessionIfNeeded();hydrateProgressState();render()})();
