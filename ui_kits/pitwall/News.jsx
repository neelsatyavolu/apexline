/* Apexline News feed. window.PW.News */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Tag, Button, IconButton, Input } = NS;
  const D = window.PW_DATA;

  const STYLE_ID = "pw-news-styles";
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    .news2 { display: grid; grid-template-columns: 1fr 300px; gap: var(--space-9); align-items: start; }
    .news2__filters { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-8); }
    .news2__search { min-width: 240px; flex: 1; max-width: 360px; }
    .feed { display: flex; flex-direction: column; gap: var(--space-7); }
    .lead { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--surface-card); }
    .lead__img { height: 240px; position: relative; overflow: hidden; background:
      radial-gradient(120% 120% at 80% 0%, color-mix(in srgb, var(--_c) 45%, transparent), transparent 60%),
      var(--grad-carbon), var(--bg-sunken); }
    .lead__img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lead__spine { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--_c); z-index: 1; }
    .lead__body { padding: var(--space-8); background: var(--surface-card); }
    .lead__meta { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-6); }
    .lead__src { font-size: var(--text-xs); color: var(--text-tertiary); }
    .lead__title { font-family: var(--font-display); font-weight: 700; font-size: var(--text-3xl); line-height: 1.08; letter-spacing: -0.01em; color: var(--text-strong); text-wrap: pretty; }
    .lead__lead { margin-top: var(--space-6); color: var(--text-secondary); font-size: var(--text-md); line-height: 1.5; max-width: 60ch; }
    .lead__foot { display: flex; align-items: center; gap: var(--space-5); margin-top: var(--space-8); }

    .feed__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-7); }
    @media (max-width: 1180px) { .feed__grid { grid-template-columns: 1fr; } }
    .item { display: flex; flex-direction: column; border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); cursor: pointer; overflow: hidden; transition: var(--tr-surface); }
    .item:hover { background: var(--surface-hover); border-color: var(--border-default); }
    .item:hover .item__thumb img { transform: scale(1.04); }
    .item[data-selected="true"] { border-color: var(--accent-border); background: var(--accent-quiet); }
    .item__thumb { position: relative; height: 156px; overflow: hidden; background:
      radial-gradient(120% 120% at 70% 10%, color-mix(in srgb, var(--_c) 50%, transparent), transparent 60%), var(--grad-carbon), var(--bg-sunken);
      border-bottom: 1px solid var(--border-subtle); }
    .item__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--dur-slow) var(--ease-out); }
    .item__thumb::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--_c); z-index: 1; }
    .item__body { display: flex; flex-direction: column; gap: 6px; padding: var(--space-7); }
    .item__meta { display: flex; align-items: center; gap: var(--space-5); }
    .item__src { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .item__title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); line-height: 1.3; text-wrap: pretty; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .item__lead { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .item__bookmark { margin-left: auto; flex: none; }
    @media (prefers-reduced-motion: reduce) { .item:hover .item__thumb img { transform: none; } }
    .trend { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) 0; border-bottom: 1px solid var(--border-subtle); }
    .trend:last-child { border-bottom: 0; }
    .trend__rank { font-family: var(--font-mono); font-weight: 700; color: var(--text-tertiary); width: 18px; }
    .trend__txt { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.35; }
    .saved { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) 0; border-bottom: 1px solid var(--border-subtle); }
    .saved:last-child { border-bottom: 0; }
    .saved__txt { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.35; }
    .empty { padding: var(--space-8); border: 1px dashed var(--border-default); border-radius: var(--radius-md); color: var(--text-tertiary); text-align: center; font-size: var(--text-sm); }
    .news-refresh-loading { min-height: 420px; display: grid; place-items: center; padding: var(--space-9); border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: radial-gradient(110% 90% at 50% 0%, var(--accent-soft), transparent 54%), var(--bg-sunken); }
    .news-refresh-loading__box { width: min(440px, 100%); display: flex; flex-direction: column; gap: var(--space-5); }
    .news-refresh-loading__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .news-refresh-loading__track { position: relative; height: 8px; border-radius: var(--radius-pill); overflow: hidden; background: rgba(255,255,255,0.08); box-shadow: var(--inset-top-light); }
    .news-refresh-loading__fill { position: absolute; inset: 0 auto 0 0; width: 42%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--success) 70%, #fff)); box-shadow: 0 0 14px var(--blue-glow); animation: news-refresh-load 1.15s var(--ease-in-out) infinite; }
    @keyframes news-refresh-load { 0% { transform: translateX(-105%); } 50% { transform: translateX(72%); } 100% { transform: translateX(240%); } }
    .news-reader { position: fixed; inset: 0; z-index: 140; display: grid; place-items: center; padding: var(--space-9); background: radial-gradient(80% 70% at 50% 8%, rgba(226,31,38,0.14), transparent 58%), rgba(3,5,8,0.78); backdrop-filter: blur(14px); }
    .news-reader__panel { width: min(920px, 100%); max-height: min(860px, calc(100vh - 48px)); overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr); border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: color-mix(in srgb, var(--surface-overlay) 95%, black); box-shadow: 0 28px 90px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.03) inset; }
    .news-reader__bar { min-width: 0; display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-base) 82%, transparent); }
    .news-reader__kicker { color: var(--text-tertiary); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .news-reader__close { margin-left: auto; }
    .news-reader__scroll { overflow-y: auto; }
    .news-reader__hero { height: clamp(210px, 34vh, 360px); position: relative; overflow: hidden; background:
      radial-gradient(120% 120% at 78% 0%, color-mix(in srgb, var(--_c) 42%, transparent), transparent 60%),
      var(--grad-carbon), var(--bg-sunken); }
    .news-reader__hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .news-reader__hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 48%, rgba(5,7,11,0.72)); pointer-events: none; }
    .news-reader__content { width: min(100%, 760px); margin-inline: auto; padding: clamp(var(--space-8), 4vw, 44px); }
    .news-reader__meta { display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; margin-bottom: var(--space-6); }
    .news-reader__source { min-width: 0; color: var(--text-tertiary); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .news-reader__title { margin: 0; max-width: 20ch; font-family: var(--font-display); font-size: clamp(30px, 4vw, 48px); line-height: 1.04; letter-spacing: 0; color: var(--text-strong); text-wrap: pretty; }
    .news-reader__deck { max-width: 68ch; margin: var(--space-7) 0 0; color: var(--text-secondary); font-size: var(--text-lg); line-height: 1.55; text-wrap: pretty; }
    .news-reader__body { max-width: 68ch; margin-top: var(--space-8); padding-top: var(--space-8); border-top: 1px solid var(--border-subtle); color: color-mix(in srgb, var(--text-primary) 88%, white); font-size: 16px; line-height: 1.72; }
    .news-reader__body p { margin: 0 0 1.15em; }
    .news-reader__body p:last-child { margin-bottom: 0; }
    .news-reader__gallery { max-width: 980px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); margin-top: var(--space-9); }
    .news-reader__gallery img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-sunken); }
    .news-reader__foot { display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; margin-top: var(--space-9); }
    .news-reader__hint { color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.4; }
    @media (max-width: 760px) {
      .news2 { grid-template-columns: 1fr; }
      .news-reader { padding: var(--space-5); }
      .news-reader__panel { max-height: calc(100vh - 24px); }
      .news-reader__content { padding: var(--space-8); }
      .news-reader__gallery { grid-template-columns: 1fr; }
    }
    `;

  function articleParagraphs(story) {
    const leadText = String(story?.lead || "").replace(/\s+/g, " ").trim();
    const bodyText = String(story?.body || story?.articleText || story?.summary || "").replace(/\r/g, "").trim();
    const rawText = bodyText.startsWith(leadText) ? bodyText.slice(leadText.length).trim() : bodyText;
    if (!rawText && leadText) return [];
    if (!rawText) return ["This source only supplied a headline. Open the source for the full article."];
    const sourceParagraphs = rawText.split(/\n{2,}/).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (sourceParagraphs.length > 1) return sourceParagraphs;
    const words = rawText.split(/\s+/);
    if (words.length <= 58) return [rawText];
    const paragraphs = [];
    for (let index = 0; index < words.length; index += 72) {
      paragraphs.push(words.slice(index, index + 72).join(" "));
    }
    return paragraphs;
  }

  function readTime(story) {
    const words = String(story?.body || story?.lead || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  function News() {
    const { data: D, dataSource, refreshData } = window.PW.usePitWall();
    const stories = D.news.map((n, i) => ({ ...n, id: n.id || "story-" + i }));
    const [filter, setFilter] = React.useState("All");
    const [query, setQuery] = React.useState("");
    const [selectedId, setSelectedId] = React.useState(stories[0]?.id);
    const [readerStory, setReaderStory] = React.useState(null);
    const [bookmarks, setBookmarks] = React.useState([]);
    const [refreshing, setRefreshing] = React.useState(false);
    const filters = ["All", ...Array.from(new Set(stories.map((story) => story.tag).filter(Boolean)))];
    const q = query.trim().toLowerCase();
    const filtered = stories.filter((n) => {
      const matchesFilter = filter === "All" || n.tag === filter;
      const haystack = [n.title, n.lead, n.source, n.tag, n.team].join(" ").toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
    const [lead, ...rest] = filtered;
    const selectedStory = stories.find((n) => n.id === selectedId) || lead || stories[0];
    const savedStories = stories.filter((n) => bookmarks.includes(n.id));
    const readerParagraphs = articleParagraphs(readerStory);
    const readerImages = Array.from(new Set([readerStory?.image, ...(readerStory?.images || [])].filter(Boolean)));

    React.useEffect(() => {
      if (!selectedId && stories[0]) setSelectedId(stories[0].id);
    }, [stories.length]);

    function toggleBookmark(id) {
      setBookmarks((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    }

    function openReader(story) {
      if (!story) return;
      setSelectedId(story.id);
      setReaderStory(story);
    }

    function openExternal(url) {
      if (!url) return;
      if (window.pitwall?.external?.openExternal) window.pitwall.external.openExternal(url);
      else window.open(url, "_blank", "noopener");
    }

    async function refreshNews() {
      if (refreshing) return;
      setRefreshing(true);
      try {
        let snapshot = await refreshData({ forceRefresh: true });
        for (let attempt = 0; snapshot?.enrichmentPending && attempt < 4; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          snapshot = await refreshData();
        }
      } finally {
        setRefreshing(false);
      }
    }

    return (
      <div className="news2">
        <div>
          <div className="news2__filters">
            <Input className="news2__search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)}
              prefix={<Icon name="search" size={14} />} placeholder="Search news" />
            {filters.map((f) => <Tag key={f} selected={filter === f} onClick={() => setFilter(f)}>{f}</Tag>)}
            <Tag swatch="var(--team-mclaren)" selected={query === "mclaren"} onClick={() => setQuery("mclaren")}>McLaren</Tag>
            <Tag swatch="var(--team-ferrari)" selected={query === "ferrari"} onClick={() => setQuery("ferrari")}>Ferrari</Tag>
            <div style={{ marginLeft: "auto" }}><Button variant="secondary" size="sm" onClick={refreshNews} disabled={refreshing} iconLeft={<Icon name="news" size={14} />}>{refreshing ? "Refreshing..." : "Refresh news"}</Button></div>
          </div>

          <div className="feed">
            {refreshing ? (
              <div className="news-refresh-loading" role="progressbar" aria-label="Loading F1 news" aria-busy="true">
                <div className="news-refresh-loading__box">
                  <div className="news-refresh-loading__top"><span>Loading F1 news</span><span>Live sources</span></div>
                  <div className="news-refresh-loading__track" aria-hidden="true"><span className="news-refresh-loading__fill" /></div>
                </div>
              </div>
            ) : lead ? (
              <article className="lead">
                <div className="lead__img" style={{ "--_c": lead.color }}>
                  {lead.image && <img src={lead.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                  <span className="lead__spine" style={{ background: lead.color }} />
                </div>
                <div className="lead__body">
                  <div className="lead__meta">
                    <Badge tone="danger">{lead.tag}</Badge>
                    <span className="lead__src">{lead.source} · {lead.time} ago</span>
                  </div>
                  <h2 className="lead__title">{lead.title}</h2>
                  <p className="lead__lead">{lead.lead}</p>
                  <div className="lead__foot">
                    <Button variant="secondary" size="sm" onClick={() => setReaderStory(lead)} iconRight={<Icon name="chevronRight" size={14} />}>Read story</Button>
                    <IconButton variant="ghost" size="sm" label="Bookmark" onClick={() => toggleBookmark(lead.id)}>
                      <Icon name="bookmark" size={16} style={{ color: bookmarks.includes(lead.id) ? "var(--accent)" : undefined }} />
                    </IconButton>
                  </div>
                </div>
              </article>
            ) : <div className="empty">No live stories loaded from RSS yet. {dataSource}. <Button variant="ghost" size="sm" onClick={refreshData}>Refresh</Button></div>}

            {rest.length > 0 && (
              <div className="feed__grid">
                {rest.map((n) => (
                  <article className="item" key={n.id} data-selected={selectedStory?.id === n.id} onClick={() => openReader(n)}>
                    <div className="item__thumb" style={{ "--_c": n.color }}>
                      {n.image && <img src={n.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                    </div>
                    <div className="item__body">
                      <div className="item__meta">
                        <Badge tone="outline">{n.tag}</Badge>
                        <span className="item__src">{n.source} · {n.time} ago</span>
                        <IconButton className="item__bookmark" variant="ghost" size="sm" label="Bookmark" onClick={(e) => { e.stopPropagation(); toggleBookmark(n.id); }}>
                          <Icon name="bookmark" size={16} style={{ color: bookmarks.includes(n.id) ? "var(--accent)" : undefined }} />
                        </IconButton>
                      </div>
                      <div className="item__title">{n.title}</div>
                      <div className="item__lead">{n.lead}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
          <Card title="Trending" subtitle="Across your sources" padding="tight">
            <div style={{ padding: "0 6px" }}>
              {stories.map((n, i) => (
                <div className="trend" key={n.id} onClick={() => openReader(n)} style={{ cursor: "pointer" }}>
                  <span className="trend__rank">{i + 1}</span>
                  <span className="trend__txt">{n.title}</span>
                </div>
              ))}
            </div>
          </Card>
          {selectedStory && (
            <Card title="Reading" subtitle={selectedStory.source + " · " + selectedStory.time + " ago"} padding="default">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Badge tone="outline">{selectedStory.tag}</Badge>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, lineHeight: 1.2, color: "var(--text-primary)" }}>{selectedStory.title}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>{selectedStory.lead}</div>
                <Button variant="secondary" size="sm" onClick={() => openReader(selectedStory)}>Open reader</Button>
              </div>
            </Card>
          )}
          <Card title="Bookmarks" aside={<Icon name="bookmark" size={15} />} padding="default">
            {savedStories.length ? savedStories.map((n) => (
              <div className="saved" key={n.id} onClick={() => openReader(n)} style={{ cursor: "pointer" }}>
                <Icon name="bookmark" size={14} />
                <span className="saved__txt">{n.title}</span>
              </div>
            )) : <div style={{ color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1.5 }}>No saved articles yet.</div>}
          </Card>
        </div>

        {readerStory && (
          <div className="news-reader" role="dialog" aria-modal="true" aria-label={readerStory.title} onClick={() => setReaderStory(null)}>
            <article className="news-reader__panel" onClick={(event) => event.stopPropagation()}>
              <div className="news-reader__bar">
                <Icon name="news" size={16} />
                <span className="news-reader__kicker">In-app reader</span>
                <span className="news-reader__source">{readerStory.source} · {readerStory.time} ago · {readTime(readerStory)} min read</span>
                <IconButton className="news-reader__close" variant="ghost" size="sm" label="Close reader" onClick={() => setReaderStory(null)}>
                  <Icon name="close" size={14} />
                </IconButton>
              </div>
              <div className="news-reader__scroll">
                {readerStory.image && (
                  <div className="news-reader__hero" style={{ "--_c": readerStory.color }}>
                    <img src={readerStory.image} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
                  </div>
                )}
                <div className="news-reader__content">
                  <div className="news-reader__meta">
                    <Badge tone="danger">{readerStory.tag}</Badge>
                    <span className="news-reader__source">{readerStory.publishedAt || readerStory.source}</span>
                  </div>
                  <h2 className="news-reader__title">{readerStory.title}</h2>
                  {readerStory.lead && <p className="news-reader__deck">{readerStory.lead}</p>}
                  {readerParagraphs.length > 0 && (
                    <div className="news-reader__body">
                      {readerParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                  )}
                  {readerImages.length > 1 && (
                    <div className="news-reader__gallery">
                      {readerImages.slice(1).map((image, index) => (
                        <img key={image || index} src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
                      ))}
                    </div>
                  )}
                  <div className="news-reader__foot">
                    {readerStory.url && <Button variant="secondary" size="sm" onClick={() => openExternal(readerStory.url)}>Open source</Button>}
                    <IconButton variant="ghost" size="sm" label="Bookmark" onClick={() => toggleBookmark(readerStory.id)}>
                      <Icon name="bookmark" size={16} style={{ color: bookmarks.includes(readerStory.id) ? "var(--accent)" : undefined }} />
                    </IconButton>
                    <span className="news-reader__hint">Reading stays in Apexline. Use source only when you want the original page.</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.News = News;
})();
