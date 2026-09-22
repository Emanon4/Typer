import { useEffect, useRef, useState } from "react";
import { STAMPS, preferStamp, preferredStampId, stampById } from "./stamps";

const COLLECTION_KEY = "typer-stamp-collection-v1";
function savedCollection() {
  try {
    const ids = JSON.parse(localStorage.getItem(COLLECTION_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(id => STAMPS.some(stamp => stamp.id === id)) : [];
  } catch { return []; }
}

export function StampAlbum({ onClose }) {
  const [selected, setSelected] = useState(preferredStampId);
  const [favorites, setFavorites] = useState(savedCollection);
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [note, setNote] = useState("");
  const dialog = useRef(null);
  const close = useRef(null);
  const stamp = stampById(selected);
  const collected = favorites.includes(selected);
  const visible = STAMPS.filter(item => !collectionOnly || favorites.includes(item.id));
  useEffect(() => { close.current?.focus(); }, []);
  function toggleCollection() {
    const next = collected ? favorites.filter(id => id !== selected) : [...favorites, selected];
    setFavorites(next);
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); }
    catch { setNote("本次已收好；浏览器暂时无法保存收藏。"); }
  }
  function handleKeys(event) {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key !== "Tab") return;
    const buttons = [...dialog.current.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <section className="stamp-album-overlay" role="dialog" aria-modal="true" aria-labelledby="stamp-album-title" onKeyDown={handleKeys} ref={dialog}>
    <button className="paper-box-scrim" aria-label="关闭集邮册" onClick={onClose} tabIndex={-1} />
    <div className="stamp-album">
      <header className="album-header">
        <div><p className="album-kicker">TYPER · PHILATELY</p><h2 id="stamp-album-title">集邮册</h2><span>第一辑　文明与远方</span></div>
        <button ref={close} className="album-close" onClick={onClose}>合上邮册</button>
      </header>
      <div className="album-body">
        <div className="album-leaf">
          <div className="album-filter" aria-label="邮票分类">
            <button aria-pressed={!collectionOnly} onClick={()=>setCollectionOnly(false)}>全部藏邮 <small>{STAMPS.length}</small></button>
            <button aria-pressed={collectionOnly} onClick={()=>setCollectionOnly(true)}>我的珍藏 <small>{favorites.length}</small></button>
          </div>
          <div className="album-grid">
            {visible.map(item=><button key={item.id} className={`album-stamp${selected===item.id?" selected":""}`} aria-pressed={selected===item.id} aria-label={`${item.name}，${item.region}${favorites.includes(item.id)?"，已收藏":""}`} onClick={()=>{setSelected(item.id);setNote("");}}>
              <span className="album-stamp-mount"><img src={item.asset} alt="" loading="lazy" /></span>
              <span>{item.name}</span><small>{item.number} · {item.region}</small>
              {favorites.includes(item.id)&&<i aria-hidden="true">✧</i>}
            </button>)}
          </div>
          {!visible.length&&<p className="album-empty">翻一翻邮册，把喜欢的那枚收入珍藏。</p>}
          <p className="album-colophon">Typer 原创藏邮 · 以各地艺术与文明为灵感</p>
        </div>
        <aside className="album-detail" aria-label="邮票详情">
          <span className="album-number">NO. {stamp.number} / XII</span>
          <img className="album-detail-art" src={stamp.asset} alt={`${stamp.name}邮票画面`} />
          <p className="album-region">{stamp.region}</p><h3>{stamp.name}</h3><p className="album-caption">{stamp.caption}</p>
          <p className="album-description">{stamp.description}</p>
          <button className="album-collect" aria-pressed={collected} onClick={toggleCollection}>{collected?"已收入珍藏 · 移出":"收入我的珍藏"}</button>
          <button className="album-use" onClick={()=>{preferStamp(stamp.id);setNote(`下次寄信，将为你贴上「${stamp.name}」。`);}}>下次寄信贴这枚</button>
          <p className="album-note" role="status">{note}</p>
        </aside>
      </div>
    </div>
  </section>;
}
