import { useEffect, useRef, useState } from "react";
import { listDocuments } from "./documentStore";
import { PaperDocument } from "./PaperDocument";
import { getPaperTemplate } from "./paperTemplates";
import { exportPaperPng } from "./exportPaper";
import { publicAsset, POST_AVAILABLE } from "./runtimeConfig";

const STAMPS = [
  {
    id: "road",
    name: "山路",
    caption: "写给远方",
    asset: "assets/post-stamp-road.png",
  },
  {
    id: "swallow",
    name: "归燕",
    caption: "见字如晤",
    asset: "assets/post-stamp-swallow.png",
  },
].map((stamp) => ({ ...stamp, asset: publicAsset(stamp.asset) }));
const stampById = (id) => STAMPS.find((stamp) => stamp.id === id) || STAMPS[0];
const date = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
async function api(path, method = "GET", body) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("邮局暂未连接，请稍后重试");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "邮局暂时无法处理");
  return data;
}

function Envelope({ letter, onOpen, from, to, stampId = "road" }) {
  const stamp = stampById(letter?.stampId || stampId);
  return (
    <div className="postal-envelope">
      <div className="envelope-from">
        <small>寄自</small>
        <span>{letter?.fromName || from || "你的署名"}</span>
        <small>{letter?.from}</small>
      </div>
      <img
        className="envelope-stamp"
        src={stamp.asset}
        alt={`${stamp.name}邮票`}
      />
      {letter && (
        <div
          className="postal-cancel"
          aria-label={`投邮时间 ${date(letter.createdAt)}`}
        >
          <span>TYPER POST</span>
          <time>{new Date(letter.createdAt).toLocaleDateString("zh-CN")}</time>
        </div>
      )}
      <div className="envelope-to">
        <small>致</small>
        <strong>{letter?.toName || to || "收信的人"}</strong>
        <span>{letter?.to}</span>
      </div>
      {onOpen && (
        <button className="envelope-open" onClick={onOpen}>
          {letter?.opened ? "展开信笺" : "拆开这封信"}
        </button>
      )}
    </div>
  );
}

export function PostOffice({
  open,
  user,
  onSession,
  onClose,
  onCompose,
  sealedDraft,
  onPosted,
}) {
  const [tab, setTab] = useState("inbox"),
    [auth, setAuth] = useState("register"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const [letters, setLetters] = useState([]),
    [drafts, setDrafts] = useState([]),
    [selected, setSelected] = useState(null),
    [opened, setOpened] = useState(null),
    [blocks, setBlocks] = useState([]);
  const [to, setTo] = useState(""),
    [title, setTitle] = useState(""),
    [stampId, setStampId] = useState("road"),
    [hours, setHours] = useState(24),
    [recipient, setRecipient] = useState(null),
    [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState({
    dailyLimit: 3,
    minHours: 24,
    acceptMail: true,
  });
  const closeRef = useRef(null),
    identity = useRef(user?.id),
    tabRef = useRef(tab);
  identity.current = user?.id;
  tabRef.current = tab;
  useEffect(() => {
    if (!POST_AVAILABLE) return;
    let alive = true;
    api("/me")
      .then((data) => {
        if (alive) onSession(data.user);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (user)
      setSettings({
        dailyLimit: user.dailyLimit,
        minHours: user.minHours,
        acceptMail: user.acceptMail,
      });
  }, [user?.id, user?.dailyLimit, user?.minHours, user?.acceptMail]);
  useEffect(() => {
    setSelected(null);
    setOpened(null);
    setLetters([]);
    setError("");
    setNote("");
  }, [user?.id]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    if (sealedDraft) {
      setTab("seal");
      setTo(sealedDraft.recipient || "");
      setTitle(sealedDraft.title || "");
      setRecipient(null);
      setReceipt(null);
      setError("");
    } else if (tab === "seal") setTab("drafts");
  }, [open, sealedDraft?.id]);
  async function refresh() {
    if (!user) return;
    const owner = user.id,
      requestedTab = tab;
    const [mail, documents, blocked] = await Promise.all([
      api(`/letters?box=${tab === "sent" ? "sent" : "inbox"}`),
      listDocuments(),
      api("/blocks"),
    ]);
    if (identity.current !== owner || tabRef.current !== requestedTab) return;
    setLetters(mail.letters);
    setDrafts(
      documents
        .filter(
          (doc) =>
            doc.kind === "letter" && doc.ownerId === owner && !doc.mailedAt,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
    setBlocks(blocked.blocks);
    onSession(mail.user);
  }
  useEffect(() => {
    if (open && user) refresh().catch((e) => setError(e.message));
  }, [open, user?.id, tab]);
  useEffect(() => {
    if (!open || !user) return;
    const timer = setInterval(() => refresh().catch(() => {}), 30000);
    return () => clearInterval(timer);
  }, [open, user?.id, tab]);
  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function changeTab(value) {
    setTab(value);
    setSelected(null);
    setOpened(null);
    setError("");
    setNote("");
    setReceipt(null);
  }
  async function authenticate(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      const result = await api(
        auth === "register" ? "/register" : "/login",
        "POST",
        { ...data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      );
      onSession(result.user);
      setTab("inbox");
    });
  }
  function compose(documentId, recipientAddress = "") {
    run(() =>
      onCompose({ documentId, recipient: recipientAddress, ownerId: user.id }),
    );
  }
  async function openLetter(letter) {
    await run(async () => {
      const data = await api(
        `/letters/${letter.id}${tab === "inbox" ? "/open" : ""}`,
        tab === "inbox" ? "POST" : "GET",
        tab === "inbox" ? {} : undefined,
      );
      setOpened(data.letter);
      await refresh();
    });
  }
  async function prepareSend(event) {
    event.preventDefault();
    if (!sealedDraft) return;
    await run(async () => {
      if (!recipient) {
        const result = await api(
          `/recipient?address=${encodeURIComponent(to)}`,
        );
        setRecipient(result.recipient);
        return;
      }
      const result = await api("/letters", "POST", {
        to: recipient.address,
        title,
        hours: Number(hours),
        nonce: sealedDraft.id,
        stampId,
        paperId: sealedDraft.paperId,
        model: sealedDraft,
      });
      onSession(result.user);
      setReceipt(result.letter);
      await onPosted(result.letter);
      setTab("sent");
    });
  }
  if (!open) return null;
  return (
    <section
      className="post-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Typer 信邮"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="post-backdrop" />
      <div className={`post-office${!user ? " post-auth" : ""}`}>
        <header className="post-header">
          <div>
            <p>TYPER · CORRESPONDENCE</p>
            <h2>信邮</h2>
          </div>
          <span className="post-motto">慢一点，写给一个人。</span>
          <button ref={closeRef} className="post-text-button" onClick={onClose}>
            回到打字机
          </button>
        </header>
        {error && (
          <p className="post-notice error" role="alert">
            {error}
          </p>
        )}
        {note && (
          <p className="post-notice" role="status">
            {note}
          </p>
        )}
        {!POST_AVAILABLE ? (
          <div className="post-auth-content">
            <img src={STAMPS[1].asset} alt="归燕邮票" className="auth-stamp" />
            <h3>线上邮局尚未开通。</h3>
            <p>账号互寄暂时不可用。你可以先用信笺写作，导出后把纸上的话交给对方。</p>
            <button className="post-text-button" onClick={onClose}>回去写作</button>
          </div>
        ) : !user ? (
          <div className="post-auth-content">
            <img src={STAMPS[1].asset} alt="归燕邮票" className="auth-stamp" />
            <h3>
              {auth === "register"
                ? "给自己一个收信的地方。"
                : "打开你的私人信箱。"}
            </h3>
            <p>领取一个邮址，寄出一封有纸张、有温度的信。</p>
            <form onSubmit={authenticate} className="post-form">
              {auth === "register" && (
                <label>
                  信上的署名
                  <input
                    name="name"
                    autoComplete="nickname"
                    required
                    maxLength={40}
                    placeholder="你希望对方如何称呼你"
                  />
                </label>
              )}
              <label>
                你的邮址
                <div className="postal-address-field">
                  <input
                    name="handle"
                    autoComplete="username"
                    required
                    pattern="[a-zA-Z][a-zA-Z0-9_\-]{2,23}"
                    minLength={3}
                    maxLength={24}
                    placeholder="例如 sean"
                  />
                  <span>@typer</span>
                </div>
              </label>
              <label>
                口令
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    auth === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={10}
                  maxLength={128}
                  placeholder="至少 10 位"
                />
              </label>
              <button className="post-primary" disabled={busy}>
                {busy
                  ? "正在办理…"
                  : auth === "register"
                    ? "领取邮址"
                    : "打开信箱"}
              </button>
            </form>
            <button
              className="post-text-button"
              onClick={() => {
                setAuth(auth === "register" ? "login" : "register");
                setError("");
              }}
            >
              {auth === "register" ? "已有邮址，登录" : "还没有邮址，领取一个"}
            </button>
          </div>
        ) : (
          <div className="post-body">
            <aside className="post-sidebar">
              <div className="postal-identity">
                <strong>{user.name}</strong>
                <span>{user.address}</span>
                <small>
                  今日已寄 {user.quota.sent} / {user.quota.limit} 封
                </small>
              </div>
              <button className="post-primary" onClick={() => compose()}>
                取信笺 · 写一封信
              </button>
              <nav aria-label="信箱分类">
                {[
                  ["inbox", "来信"],
                  ["sent", "寄出的信"],
                  ["drafts", "未寄出的信"],
                  ["settings", "邮局设置"],
                ].map(([key, label]) => (
                  <button
                    className={tab === key ? "active" : ""}
                    aria-pressed={tab === key}
                    onClick={() => changeTab(key)}
                    key={key}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <p className="post-sidebar-note">有些话，值得等一封信。</p>
              <button
                className="post-text-button sign-out"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/logout", "POST", {});
                    onSession(null);
                    setSelected(null);
                    setOpened(null);
                    setReceipt(null);
                  })
                }
              >
                收好信箱 · 登出
              </button>
            </aside>
            <div className="post-content">
              {receipt && (
                <div className="postal-receipt" role="status">
                  <strong>已投邮</strong>
                  <p>
                    寄给 {receipt.toName}，
                    {receipt.delivered
                      ? "已经送达"
                      : `预计 ${date(receipt.deliverAt)} 送达`}
                    。
                  </p>
                  <small>你可以合上信箱，信会继续走它的路。</small>
                </div>
              )}
              {tab === "seal" && sealedDraft ? (
                <form className="seal-form" onSubmit={prepareSend}>
                  <div className="post-section-title">
                    <h3>折纸，封缄。</h3>
                    <p>字已落纸，选一枚邮票，把它寄给对方。</p>
                  </div>
                  <Envelope
                    from={user.name}
                    to={recipient?.name || to}
                    stampId={stampId}
                  />
                  <div className="seal-fields">
                    <label>
                      收件人的邮址
                      <input
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setRecipient(null);
                        }}
                        required
                        placeholder="对方的邮址 @typer"
                      />
                    </label>
                    <label>
                      信封上的题记
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={80}
                        placeholder="例如：秋天的第一封信"
                      />
                    </label>
                  </div>
                  <fieldset className="stamp-picker">
                    <legend>贴一枚邮票</legend>
                    {STAMPS.map((stamp) => (
                      <button
                        type="button"
                        className={stampId === stamp.id ? "selected" : ""}
                        aria-pressed={stampId === stamp.id}
                        onClick={() => setStampId(stamp.id)}
                        key={stamp.id}
                      >
                        <img src={stamp.asset} alt="" />
                        <span>
                          {stamp.name}
                          <small>{stamp.caption}</small>
                        </span>
                      </button>
                    ))}
                  </fieldset>
                  <label className="postal-delay">
                    这封信的邮程
                    <select
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                    >
                      {[
                        [0, "直接投递"],
                        [1, "一小时"],
                        [6, "六小时"],
                        [24, "一天"],
                        [72, "三天"],
                        [168, "一周"],
                      ].map(([n, label]) => (
                        <option value={n} key={n}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {recipient && (
                    <div className="address-confirmation">
                      收件人：<strong>{recipient.name}</strong> ·{" "}
                      {recipient.address}
                      <br />
                      <small>
                        投邮后至少 {Math.max(Number(hours), recipient.minHours)}{" "}
                        小时送达，尊重对方的收信节奏。
                      </small>
                    </div>
                  )}
                  <button className="post-primary" disabled={busy}>
                    {busy
                      ? "正在办理…"
                      : recipient
                        ? "封口并投邮"
                        : "核对收件人"}
                  </button>
                </form>
              ) : tab === "settings" ? (
                <div className="postal-settings">
                  <div className="post-section-title">
                    <h3>留一点等待的时间。</h3>
                    <p>你的节奏，由你决定。</p>
                  </div>
                  <form
                    className="post-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run(async () => {
                        const result = await api(
                          "/settings",
                          "PATCH",
                          settings,
                        );
                        onSession(result.user);
                        setNote("邮局已记下你的新安排");
                      });
                    }}
                  >
                    <label>
                      每天最多寄几封
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={settings.dailyLimit}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyLimit: Number(e.target.value),
                          })
                        }
                      />
                      <small>
                        按 {user.timezone} 的自然日计数。草稿可以一直写。
                      </small>
                    </label>
                    <label>
                      我愿意等待的最短邮程
                      <select
                        value={settings.minHours}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            minHours: Number(e.target.value),
                          })
                        }
                      >
                        {[
                          [0, "不要求等待"],
                          [1, "一小时"],
                          [6, "六小时"],
                          [24, "一天"],
                          [72, "三天"],
                          [168, "一周"],
                        ].map(([n, label]) => (
                          <option value={n} key={n}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <small>别人寄给你的信，不会比这个时间更早到达。</small>
                    </label>
                    <label className="postal-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.acceptMail}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            acceptMail: e.target.checked,
                          })
                        }
                      />
                      接收新的来信
                    </label>
                    <button className="post-primary" disabled={busy}>
                      保存邮局设置
                    </button>
                  </form>
                  <details className="blocked-addresses">
                    <summary>不再接收某个邮址的来信</summary>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const address = new FormData(event.currentTarget).get(
                          "address",
                        );
                        run(async () => {
                          await api("/blocks", "POST", { address });
                          await refresh();
                          setNote("已停止接收这个邮址的新来信");
                        });
                      }}
                    >
                      <input
                        name="address"
                        required
                        aria-label="停止来信的邮址"
                        placeholder="对方的邮址"
                      />
                      <button disabled={busy}>停止来信</button>
                    </form>
                    {blocks.map((b) => (
                      <div key={b.handle}>
                        {b.name} · {b.handle}@typer
                        <button
                          onClick={() =>
                            run(async () => {
                              await api("/blocks", "DELETE", {
                                address: b.handle,
                              });
                              await refresh();
                            })
                          }
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                  </details>
                </div>
              ) : tab === "drafts" ? (
                <>
                  <div className="post-section-title">
                    <h3>还没寄出的心事。</h3>
                    <p>不用急，把话写完。</p>
                  </div>
                  {drafts.length ? (
                    <div className="postal-letter-list">
                      {drafts.map((doc) => (
                        <button
                          className="postal-letter"
                          key={doc.id}
                          onClick={() => compose(doc.id)}
                        >
                          <strong>
                            {doc.recipient
                              ? `致 ${doc.recipient}`
                              : "未题名的信"}
                          </strong>
                          <span>
                            {doc.excerpt || "信笺已备好，还没有落字。"}
                          </span>
                          <small>{date(doc.updatedAt)} · 续写</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="postal-empty">
                      抽屉里还没有草稿。取一张信笺，慢慢写。
                    </p>
                  )}
                </>
              ) : opened ? (
                <div className="opened-letter">
                  <button
                    className="post-text-button"
                    onClick={() => {
                      setOpened(null);
                      setSelected(null);
                    }}
                  >
                    回到信箱
                  </button>
                  <p className="letter-reading-title">
                    {opened.title} · {opened.fromName}
                  </p>
                  <PaperDocument
                    draft={opened.model}
                    paper={getPaperTemplate(opened.paperId)}
                  />
                  <div className="postal-reading-actions">
                    {tab === "inbox" && (
                      <button
                        className="post-primary"
                        onClick={() => compose(undefined, opened.from)}
                      >
                        另取信笺 · 回信
                      </button>
                    )}
                    <button
                      onClick={() =>
                        run(() =>
                          exportPaperPng(
                            opened.model,
                            getPaperTemplate(opened.paperId),
                          ),
                        )
                      }
                    >
                      保存信笺 PNG
                    </button>
                  </div>
                </div>
              ) : selected ? (
                <>
                  <button
                    className="post-text-button"
                    onClick={() => setSelected(null)}
                  >
                    回到信箱
                  </button>
                  <Envelope
                    letter={selected}
                    onOpen={() => openLetter(selected)}
                  />
                  <p className="post-arrival">
                    {selected.delivered
                      ? `${date(selected.deliverAt)} 已送达`
                      : `仍在邮路上 · ${date(selected.deliverAt)} 送达`}
                  </p>
                </>
              ) : (
                <>
                  <div className="post-section-title">
                    <h3>
                      {tab === "sent" ? "寄出的信，各有归处。" : "见字如晤。"}
                    </h3>
                    <button
                      className="post-text-button"
                      onClick={() => run(refresh)}
                      disabled={busy}
                    >
                      查看新来信
                    </button>
                  </div>
                  {letters.length ? (
                    <div className="postal-letter-list">
                      {letters.map((letter) => (
                        <button
                          className="postal-letter"
                          key={letter.id}
                          onClick={() => setSelected(letter)}
                        >
                          <img src={stampById(letter.stampId).asset} alt="" />
                          <div>
                            <strong>
                              {tab === "sent"
                                ? `致 ${letter.toName}`
                                : `来自 ${letter.fromName}`}
                            </strong>
                            <span>{letter.title}</span>
                            <small>
                              {tab === "sent"
                                ? letter.delivered
                                  ? "已送达"
                                  : `${date(letter.deliverAt)} 送达`
                                : `${date(letter.deliverAt)} · ${letter.opened ? "已拆封" : "待拆封"}`}
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="postal-empty">
                      <img src={STAMPS[0].asset} alt="山路邮票" />
                      <p>
                        {tab === "sent"
                          ? "还没有寄出的信。"
                          : "信箱还静着，第一封信正在未来等你。"}
                      </p>
                      <small>把 {user.address} 告诉想通信的人。</small>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
