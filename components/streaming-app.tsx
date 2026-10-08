"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Artwork } from "@/components/artwork";
import { DevPanel } from "@/components/dev-panel";
import { VideoPlayer } from "@/components/video-player";
import { rails, titleById, titles, type Title } from "@/lib/catalog";
import { useDevPanel } from "@/lib/dev-panel";

type View =
  | { kind: "browse" }
  | { kind: "detail"; title: Title }
  | { kind: "watch"; title: Title };

function Brand() {
  return (
    <span className="brand" aria-label="NotFlix">
      NOTFLIX
    </span>
  );
}

function PlayButton({
  onClick,
  label = "Play",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="button button-light" onClick={onClick}>
      <span aria-hidden="true">▶</span>
      {label}
    </button>
  );
}

function TitleCard({
  title,
  index,
  onOpen,
  onPlay,
}: {
  title: Title;
  index?: number;
  onOpen: () => void;
  onPlay: () => void;
}) {
  return (
    <article
      className="title-card"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
    >
      <div className="card-art-wrap">
        {index !== undefined && (
          <span className="rank-number">{index + 1}</span>
        )}
        <Artwork artwork={title.artwork} />
        <div className="card-title-lockup">
          <span>{title.name}</span>
        </div>
        {title.badge && <span className="card-badge">{title.badge}</span>}
        {title.progress !== undefined && (
          <div className="card-progress">
            <span style={{ width: `${title.progress}%` }} />
          </div>
        )}
      </div>
      <div className="card-expanded">
        <div className="card-actions">
          <button
            className="round-button round-light"
            aria-label={`Play ${title.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
          >
            ▶
          </button>
          <button
            className="round-button"
            aria-label="Add to My List"
            onClick={(event) => event.stopPropagation()}
          >
            ＋
          </button>
          <button
            className="round-button"
            aria-label="Like"
            onClick={(event) => event.stopPropagation()}
          >
            ♡
          </button>
          <button
            className="round-button card-more"
            aria-label={`More information about ${title.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            ⌄
          </button>
        </div>
        <div className="card-meta">
          <strong>{title.match}% Match</strong>
          <span>{title.rating}</span>
          <span>{title.runtime}</span>
        </div>
        <div className="card-genres">
          {title.genres.slice(0, 3).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ContentRail({
  label,
  ids,
  ranked,
  onOpen,
  onPlay,
}: {
  label: string;
  ids: string[];
  ranked?: boolean;
  onOpen: (title: Title) => void;
  onPlay: (title: Title) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) =>
    railRef.current?.scrollBy({
      left: direction * railRef.current.clientWidth * 0.78,
      behavior: "smooth",
    });
  return (
    <section className={`content-rail ${ranked ? "ranked-rail" : ""}`}>
      <div className="rail-heading">
        <h2>{label}</h2>
        <button>
          Explore all <span>›</span>
        </button>
      </div>
      <div className="rail-shell">
        <button
          className="rail-arrow rail-arrow-left"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${label} left`}
        >
          ‹
        </button>
        <div className="rail-track" ref={railRef}>
          {ids.map((id, index) => {
            const title = titleById(id);
            return (
              <TitleCard
                key={id}
                title={title}
                index={ranked ? index : undefined}
                onOpen={() => onOpen(title)}
                onPlay={() => onPlay(title)}
              />
            );
          })}
        </div>
        <button
          className="rail-arrow rail-arrow-right"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${label} right`}
        >
          ›
        </button>
      </div>
    </section>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const openDevPanel = useDevPanel((state) => state.set);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="profile-wrap" ref={ref}>
      <button
        className="profile-button"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>J</span>
        <i>⌄</i>
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-head">
            <span>J</span>
            <strong>Jaidev</strong>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              openDevPanel(true);
              setOpen(false);
            }}
          >
            Audio check
            <small>D</small>
          </button>
          <button role="menuitem" onClick={() => setOpen(false)}>
            Account
          </button>
          <button role="menuitem" onClick={() => setOpen(false)}>
            Help Center
          </button>
        </div>
      )}
    </div>
  );
}

function Browse({
  onOpen,
  onPlay,
}: {
  onOpen: (title: Title) => void;
  onPlay: (title: Title) => void;
}) {
  const featured = titles[0];
  const [navSolid, setNavSolid] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(
    () =>
      query.trim()
        ? titles.filter((title) =>
            `${title.name} ${title.genres.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : [],
    [query],
  );

  return (
    <main className="browse-view">
      <nav className={`top-nav ${navSolid ? "solid" : ""}`}>
        <Brand />
        <div className="nav-links">
          <a href="#home" className="active">
            Home
          </a>
          <a href="#series">Series</a>
          <a href="#films">Films</a>
          <a href="#new">New & Popular</a>
          <a href="#list">My List</a>
          <a href="/segmentation-lab">Perception Lab</a>
          <a href="/sim-lab">Simulation Lab</a>
        </div>
        <div className="nav-actions">
          <div className={`search-box ${searchOpen ? "open" : ""}`}>
            <button
              aria-label="Search"
              onClick={() => setSearchOpen((value) => !value)}
            >
              ⌕
            </button>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titles, people, genres"
              aria-label="Search titles"
            />
          </div>
          <button className="nav-icon" aria-label="Notifications">
            ◉
          </button>
          <ProfileMenu />
        </div>
      </nav>

      <section id="home" className="hero">
        <Artwork artwork={featured.artwork} className="hero-art" />
        {featured.playback.src && (
          <video
            className="hero-video"
            src={`${featured.playback.src}#t=62`}
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
            onLoadedData={(event) => event.currentTarget.classList.add("ready")}
          />
        )}
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="hero-eyebrow">
            {featured.eyebrow} <span>· {featured.year}</span>
          </p>
          <h1>{featured.name}</h1>
          <p className="hero-tagline">{featured.tagline}</p>
          <div className="hero-badge-line">
            <span className="top-ten-mark">
              TOP
              <br />
              <b>10</b>
            </span>
            <strong>{featured.badge}</strong>
          </div>
          <p className="hero-description">{featured.description}</p>
          {featured.credit && <p className="hero-credit">{featured.credit}</p>}
          <div className="hero-actions">
            <PlayButton onClick={() => onPlay(featured)} />
            <button
              className="button button-glass"
              onClick={() => onOpen(featured)}
            >
              <span>ⓘ</span>More Info
            </button>
          </div>
        </div>
        <button className="hero-sound" aria-label="Toggle preview sound">
          ◖
        </button>
        <span className="hero-rating">{featured.rating}</span>
      </section>

      <div className="rails-wrap">
        {query && (
          <ContentRail
            label={`Results for “${query}”`}
            ids={filtered.map((title) => title.id)}
            onOpen={onOpen}
            onPlay={onPlay}
          />
        )}
        {rails.map((rail, index) => (
          <ContentRail
            key={rail.title}
            label={rail.title}
            ids={rail.ids}
            ranked={index === 1}
            onOpen={onOpen}
            onPlay={onPlay}
          />
        ))}
      </div>
      <footer>
        <Brand />
        <p>Fictional stories. Real atmosphere.</p>
        <div>
          <a href="#">Audio Description</a>
          <a href="#">Help Center</a>
          <a href="#">Terms of Use</a>
          <a href="#">Privacy</a>
        </div>
        <small>© 2026 NotFlix. Definitely not Netflix.</small>
      </footer>
    </main>
  );
}

function DetailModal({
  title,
  onClose,
  onPlay,
  onSelect,
}: {
  title: Title;
  onClose: () => void;
  onPlay: () => void;
  onSelect: (title: Title) => void;
}) {
  const related = titles.filter((item) => item.id !== title.id).slice(0, 3);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`${title.name} details`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <article className="detail-modal">
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
        <div className="detail-hero">
          <Artwork artwork={title.artwork} />
          <div className="detail-shade" />
          <div className="detail-title">
            <p>{title.badge ?? "A NOTFLIX SELECTION"}</p>
            <h2>{title.name}</h2>
            <span>{title.tagline}</span>
            <div className="detail-actions">
              <PlayButton onClick={onPlay} />
              <button className="round-button" aria-label="Add to My List">
                ＋
              </button>
              <button className="round-button" aria-label="Like">
                ♡
              </button>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-copy">
            <div className="detail-meta">
              <strong>{title.match}% Match</strong>
              <span>{title.year}</span>
              <span className="rating-chip">{title.rating}</span>
              <span>{title.runtime}</span>
              <span className="quality-chip">HD</span>
            </div>
            <p>{title.description}</p>
          </div>
          <dl>
            <div>
              <dt>Cast:</dt>
              <dd>{title.cast.join(", ")}</dd>
            </div>
            <div>
              <dt>Genres:</dt>
              <dd>{title.genres.join(", ")}</dd>
            </div>
            <div>
              <dt>This title is:</dt>
              <dd>Atmospheric, Cerebral, Suspenseful</dd>
            </div>
          </dl>
        </div>
        <section className="more-like">
          <h3>More Like This</h3>
          <div className="more-grid">
            {related.map((item) => (
              <button key={item.id} onClick={() => onSelect(item)}>
                <div>
                  <Artwork artwork={item.artwork} />
                  <span>{item.name}</span>
                </div>
                <p>
                  <strong>{item.match}% Match</strong>
                  <em>{item.rating}</em>
                </p>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </section>
        <div className="about-title">
          <h3>
            About <strong>{title.name}</strong>
          </h3>
          <p>
            <span>Creator:</span> Ada Mercer
          </p>
          <p>
            <span>Cast:</span> {title.cast.join(", ")}
          </p>
          <p>
            <span>Genres:</span> {title.genres.join(", ")}
          </p>
        </div>
      </article>
    </div>
  );
}

export function StreamingApp() {
  const [view, setView] = useState<View>({ kind: "browse" });
  const [detailTitle, setDetailTitle] = useState<Title | null>(null);
  const openDetail = useCallback((title: Title) => {
    startTransition(() => {
      setDetailTitle(title);
      setView({ kind: "detail", title });
    });
  }, []);
  const play = useCallback((title: Title) => {
    // Straight into a full-screen player (the click is the user gesture).
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    startTransition(() => setView({ kind: "watch", title }));
  }, []);

  if (view.kind === "watch")
    return (
      <>
        <VideoPlayer
          title={view.title}
          source={view.title.playback}
          onBack={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
            setDetailTitle(view.title);
            setView({ kind: "detail", title: view.title });
          }}
        />
        <DevPanel />
      </>
    );
  return (
    <>
      <DevPanel />
      <Browse onOpen={openDetail} onPlay={play} />
      {view.kind === "detail" && detailTitle && (
        <DetailModal
          title={detailTitle}
          onClose={() => {
            setDetailTitle(null);
            setView({ kind: "browse" });
          }}
          onPlay={() => play(detailTitle)}
          onSelect={openDetail}
        />
      )}
    </>
  );
}
