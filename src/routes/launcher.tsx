import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Battery,
  BatteryCharging,
  Bell,
  Boxes,
  Building2,
  Bus,
  Check,
  Compass,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  GripVertical,
  Inbox,
  LayoutDashboard,
  Leaf,
  LineChart,
  Map as MapIcon,
  Network,
  Pencil,
  PieChart,
  PlugZap,
  Radar,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Truck,
  Users,
  Workflow,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";

export const Route = createFileRoute("/launcher")({
  head: () => ({
    meta: [
      { title: "Voltline · Product Launcher" },
      {
        name: "description",
        content:
          "The single sign-in surface for the Transvolt ecosystem. Launch every product from one place.",
      },
    ],
  }),
  component: LauncherPage,
});

/* ------------------------------------------------------------------ *
 * Types & data layer
 * ------------------------------------------------------------------ *
 * The store below is an in-memory stand-in shaped exactly like a REST
 * resource client. Swapping `createLocalProductApi()` for a real fetch
 * based implementation (same method signatures) is the only change
 * needed to go live against an endpoint.
 * ------------------------------------------------------------------ */

type ProductStatus = "live" | "beta" | "coming-soon";

interface ProductMetric {
  label: string;
  value: string;
}

interface Product {
  id: string;
  name: string;
  tagline: string;
  status: ProductStatus;
  url: string;
  icon: string; // lucide icon name, resolved via ICON_LIBRARY
  accent: string; // per-product brand hex
  category: string;
  metric?: ProductMetric;
  hidden?: boolean;
}

interface ProductApi {
  list(): Promise<Product[]>;
  create(input: Product): Promise<Product>;
  update(input: Product): Promise<Product>;
  remove(id: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
}

const SEED_PRODUCTS: Product[] = [
  {
    id: "tims",
    name: "TIMS",
    tagline: "Integrated Mobility System — depots, routes & crews in one nerve center.",
    status: "live",
    url: "https://tims.transvolt.io",
    icon: "RouteIcon",
    accent: "#F59E0B",
    category: "Operations",
    metric: { label: "Active routes", value: "1,284" },
  },
  {
    id: "evopt",
    name: "EVopt Charging",
    tagline: "Live charging dashboard — sessions, energy and depot health in real time.",
    status: "live",
    url: "https://evopt.transvolt.io",
    icon: "BatteryCharging",
    accent: "#10B981",
    category: "Charging",
    metric: { label: "Live chargers", value: "342" },
  },
  {
    id: "pulse",
    name: "Pulse Analytics",
    tagline: "Fleet intelligence & executive reporting across the entire network.",
    status: "live",
    url: "https://pulse.transvolt.io",
    icon: "BarChart3",
    accent: "#8B5CF6",
    category: "Analytics",
    metric: { label: "Reports / day", value: "5.6k" },
  },
  {
    id: "gridlink",
    name: "GridLink",
    tagline: "Depot energy & grid orchestration — load balancing and tariff optimisation.",
    status: "beta",
    url: "https://gridlink.transvolt.io",
    icon: "PlugZap",
    accent: "#0EA5E9",
    category: "Charging",
    metric: { label: "Sites online", value: "47" },
  },
  {
    id: "sentinel",
    name: "Sentinel",
    tagline: "Safety & compliance monitoring with proactive incident detection.",
    status: "coming-soon",
    url: "https://sentinel.transvolt.io",
    icon: "ShieldCheck",
    accent: "#F43F5E",
    category: "Operations",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Network planning & electrification simulation for future corridors.",
    status: "coming-soon",
    url: "https://atlas.transvolt.io",
    icon: "Compass",
    accent: "#14B8A6",
    category: "Analytics",
  },
];

function createLocalProductApi(seed: Product[]): ProductApi {
  let data: Product[] = seed.map((p) => ({ ...p }));
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    async list() {
      await wait(650);
      return data.map((p) => ({ ...p }));
    },
    async create(input) {
      await wait(220);
      data = [...data, { ...input }];
      return { ...input };
    },
    async update(input) {
      await wait(160);
      data = data.map((p) => (p.id === input.id ? { ...input } : p));
      return { ...input };
    },
    async remove(id) {
      await wait(160);
      data = data.filter((p) => p.id !== id);
    },
    async reorder(orderedIds) {
      await wait(80);
      const map = new Map(data.map((p) => [p.id, p]));
      data = orderedIds
        .map((id) => map.get(id))
        .filter((p): p is Product => Boolean(p));
    },
  };
}

type LoadState = "loading" | "ready" | "error";

function useProducts(api: ProductApi) {
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await api.list();
      setProducts(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const createProduct = useCallback(
    async (input: Product) => {
      setProducts((prev) => [...prev, input]);
      await api.create(input);
    },
    [api],
  );

  const updateProduct = useCallback(
    async (input: Product) => {
      setProducts((prev) => prev.map((p) => (p.id === input.id ? input : p)));
      await api.update(input);
    },
    [api],
  );

  const removeProduct = useCallback(
    async (id: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await api.remove(id);
    },
    [api],
  );

  const reorderProducts = useCallback(
    async (orderedIds: string[]) => {
      setProducts((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        return orderedIds
          .map((id) => map.get(id))
          .filter((p): p is Product => Boolean(p));
      });
      await api.reorder(orderedIds);
    },
    [api],
  );

  return {
    products,
    state,
    reload: load,
    createProduct,
    updateProduct,
    removeProduct,
    reorderProducts,
  };
}

/* ------------------------------------------------------------------ *
 * Icon library (searchable picker source)
 * ------------------------------------------------------------------ */

const ICON_LIBRARY: Record<string, LucideIcon> = {
  RouteIcon,
  Zap,
  BatteryCharging,
  Battery,
  PlugZap,
  Activity,
  BarChart3,
  LineChart,
  PieChart,
  Network,
  ShieldCheck,
  Compass,
  MapIcon,
  Gauge,
  Cpu,
  Database,
  Server,
  Bus,
  Truck,
  Leaf,
  Sun,
  Radar,
  Boxes,
  LayoutDashboard,
  Workflow,
  Wrench,
  Bell,
  Globe,
  Building2,
  Users,
};

const ICON_NAMES = Object.keys(ICON_LIBRARY);

function resolveIcon(name: string): LucideIcon {
  return ICON_LIBRARY[name] ?? Boxes;
}

const ACCENT_SWATCHES = [
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#0EA5E9",
  "#F43F5E",
  "#14B8A6",
  "#6366F1",
  "#EC4899",
  "#84CC16",
  "#EAB308",
];

const CATEGORY_ORDER = ["Operations", "Charging", "Analytics"];

const VOLT = "#5B8CFF"; // Voltline chrome accent — used sparingly

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

interface ToastMsg {
  id: number;
  text: string;
  tone: "success" | "info";
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

function LauncherPage() {
  const apiRef = useRef<ProductApi>(createLocalProductApi(SEED_PRODUCTS));
  const {
    products,
    state,
    reload,
    createProduct,
    updateProduct,
    removeProduct,
    reorderProducts,
  } = useProducts(apiRef.current);

  const [admin, setAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const pushToast = useCallback((text: string, tone: ToastMsg["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!admin && p.hidden) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, admin]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of visibleProducts) {
      const arr = groups.get(p.category) ?? [];
      arr.push(p);
      groups.set(p.category, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0]);
      const ib = CATEGORY_ORDER.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [visibleProducts]);

  const openLanding = useCallback((product: Product) => {
    if (product.status === "coming-soon") return;
    window.open(product.url, "_blank", "noopener,noreferrer");
  }, []);

  const handleSave = useCallback(
    async (product: Product) => {
      const isEdit = products.some((p) => p.id === product.id);
      if (isEdit) {
        await updateProduct(product);
        pushToast(`${product.name} updated`);
      } else {
        await createProduct(product);
        pushToast(`${product.name} onboarded to Voltline`);
      }
      setModalOpen(false);
      setEditing(null);
    },
    [products, updateProduct, createProduct, pushToast],
  );

  const handleToggleHidden = useCallback(
    (product: Product) => {
      const next = { ...product, hidden: !product.hidden };
      void updateProduct(next);
      pushToast(next.hidden ? `${product.name} hidden` : `${product.name} visible`, "info");
    },
    [updateProduct, pushToast],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const name = confirmDelete.name;
    await removeProduct(confirmDelete.id);
    setConfirmDelete(null);
    pushToast(`${name} removed`, "info");
  }, [confirmDelete, removeProduct, pushToast]);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId) {
        setDragId(null);
        setDragOverId(null);
        return;
      }
      const ids = products.map((p) => p.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      void reorderProducts(ids);
      setDragId(null);
      setDragOverId(null);
    },
    [dragId, products, reorderProducts],
  );

  const liveCount = products.filter((p) => p.status === "live" && !p.hidden).length;

  return (
    <div className="vl-root min-h-screen text-foreground">
      <StyleInjector />

      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 vl-backdrop" />

      {/* ---------------- Shared app navbar (unchanged) ---------------- */}
      <AppNav />

      {/* ---------------- Body ---------------- */}
      <main className="relative z-[1] mx-auto max-w-[1480px] px-5 pb-24 pt-8 sm:px-8">
        {/* Hero + toolbar */}
        <div className="mb-8 flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="vl-mono text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                Transvolt Ecosystem
              </p>
              <h1 className="vl-head mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                {admin ? "Configure workspace" : "Good day. Launch your day."}
              </h1>
              <p className="vl-ui mt-1 text-sm text-muted-foreground">
                {admin
                  ? "Onboard, edit, reorder and curate the products your team sees."
                  : `${liveCount} products live · one sign-in, every surface.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <AdminToggle admin={admin} onToggle={() => setAdmin((a) => !a)} />
              {admin && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                  className="vl-ui group inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white shadow-lg transition active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(180deg, ${VOLT}, #3f6fe0)`,
                    boxShadow: `0 8px 24px -10px ${VOLT}`,
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Onboard New Product</span>
                  <span className="sm:hidden">Onboard</span>
                </button>
              )}
            </div>
          </div>

          {/* product filter */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, categories…"
              className="vl-ui h-11 w-full rounded-xl border border-border bg-muted/40 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-ring focus:bg-muted/60 sm:max-w-md"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3.5 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* States */}
        {state === "loading" && <GridSkeleton />}
        {state === "error" && <ErrorState onRetry={() => void reload()} />}
        {state === "ready" && visibleProducts.length === 0 && (
          <EmptyState
            query={query}
            admin={admin}
            onClear={() => setQuery("")}
            onAdd={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          />
        )}

        {state === "ready" &&
          visibleProducts.length > 0 &&
          grouped.map(([category, items]) => (
            <section key={category} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="vl-head text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  {category}
                </h2>
                <span className="vl-mono rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {items.length}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5">
                {items.map((product, index) => (
                  <ProductWidget
                    key={product.id}
                    product={product}
                    index={index}
                    admin={admin}
                    dragging={dragId === product.id}
                    dragOver={dragOverId === product.id}
                    onOpen={() => openLanding(product)}
                    onEdit={() => {
                      setEditing(product);
                      setModalOpen(true);
                    }}
                    onToggleHidden={() => handleToggleHidden(product)}
                    onDelete={() => setConfirmDelete(product)}
                    onNotify={() => pushToast(`We'll notify you when ${product.name} ships`, "info")}
                    onDragStart={() => setDragId(product.id)}
                    onDragEnter={() => setDragOverId(product.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    onDrop={() => handleDrop(product.id)}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>

      {/* ---------------- Modal ---------------- */}
      {modalOpen && (
        <ProductModal
          initial={editing}
          existingCategories={Array.from(new Set(products.map((p) => p.category)))}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* ---------------- Delete confirm ---------------- */}
      {confirmDelete && (
        <ConfirmDialog
          product={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}

      {/* ---------------- Toasts ---------------- */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="vl-toast vl-ui pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border bg-popover/95 px-4 py-3 text-sm text-foreground shadow-2xl backdrop-blur"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                background: t.tone === "success" ? "rgba(16,185,129,0.16)" : "rgba(91,140,255,0.16)",
                color: t.tone === "success" ? "#10b981" : VOLT,
              }}
            >
              {t.tone === "success" ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chrome pieces
 * ------------------------------------------------------------------ */

function AdminToggle({ admin, onToggle }: { admin: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`vl-ui inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition active:scale-[0.97] ${
        admin ? "" : "border-border bg-muted/40 text-foreground hover:bg-muted"
      }`}
      style={
        admin
          ? { borderColor: `${VOLT}80`, background: `${VOLT}1f`, color: VOLT }
          : undefined
      }
      aria-pressed={admin}
    >
      <Settings2 className={`h-4 w-4 ${admin ? "vl-spin-slow" : ""}`} />
      <span className="hidden sm:inline">{admin ? "Configuring" : "Admin"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Product widget — the centerpiece
 * ------------------------------------------------------------------ */

interface WidgetProps {
  product: Product;
  index: number;
  admin: boolean;
  dragging: boolean;
  dragOver: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onNotify: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

function ProductWidget({
  product,
  index,
  admin,
  dragging,
  dragOver,
  onOpen,
  onEdit,
  onToggleHidden,
  onDelete,
  onNotify,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: WidgetProps) {
  const Icon = resolveIcon(product.icon);
  const isComingSoon = product.status === "coming-soon";
  const clickable = !admin && !isComingSoon;

  const handleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  const style = {
    ["--accent" as string]: product.accent,
    animationDelay: `${Math.min(index, 8) * 70}ms`,
  } as CSSProperties;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={clickable ? `Open ${product.name}` : product.name}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={handleKey}
      draggable={admin}
      onDragStart={admin ? onDragStart : undefined}
      onDragEnter={admin ? onDragEnter : undefined}
      onDragOver={admin ? (e) => e.preventDefault() : undefined}
      onDragEnd={admin ? onDragEnd : undefined}
      onDrop={admin ? onDrop : undefined}
      style={style}
      className={[
        "vl-card vl-rise group relative flex flex-col overflow-hidden rounded-2xl border p-5 outline-none transition-all duration-300",
        "border-border bg-card",
        clickable ? "cursor-pointer hover:-translate-y-1 focus-visible:-translate-y-1" : "",
        admin ? "cursor-grab active:cursor-grabbing" : "",
        isComingSoon && !admin ? "vl-dim" : "",
        dragging ? "opacity-40" : "",
        dragOver ? "vl-dragover" : "",
        product.hidden && admin ? "opacity-50" : "",
      ].join(" ")}
    >
      {/* accent sheen */}
      {product.status === "live" && <span className="vl-sheen pointer-events-none absolute inset-0" />}
      {/* top hairline glow */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${product.accent}, transparent)` }}
      />

      {/* admin toolbar */}
      {admin && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-popover/90 p-1 backdrop-blur">
          <span className="flex h-6 w-5 cursor-grab items-center justify-center text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </span>
          <IconBtn label="Edit" onClick={(e) => stop(e, onEdit)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={product.hidden ? "Show" : "Hide"} onClick={(e) => stop(e, onToggleHidden)}>
            {product.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn label="Delete" danger onClick={(e) => stop(e, onDelete)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}

      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="relative flex h-12 w-12 items-center justify-center rounded-xl border"
          style={{
            background: `${product.accent}1a`,
            borderColor: `${product.accent}33`,
            color: product.accent,
          }}
        >
          <Icon className="h-6 w-6" />
        </span>
        {!admin && <StatusPill status={product.status} accent={product.accent} />}
      </div>

      {/* body */}
      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="vl-head text-[17px] font-semibold tracking-tight text-foreground">{product.name}</h3>
        <p className="vl-ui mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {product.tagline}
        </p>
      </div>

      {/* footer */}
      <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
        {product.metric ? (
          <div>
            <p
              className="vl-mono text-xl font-bold leading-none"
              style={{ color: isComingSoon ? undefined : product.accent }}
            >
              <span className={isComingSoon ? "text-muted-foreground" : undefined}>{product.metric.value}</span>
            </p>
            <p className="vl-ui mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {product.metric.label}
            </p>
          </div>
        ) : (
          <span className="vl-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {product.category}
          </span>
        )}

        {!admin &&
          (isComingSoon ? (
            <button
              onClick={(e) => stop(e, onNotify)}
              className="vl-ui inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" />
              Notify me
            </button>
          ) : (
            <span
              className="vl-ui inline-flex items-center gap-1 text-[12px] font-medium opacity-0 transition group-hover:opacity-100"
              style={{ color: product.accent }}
            >
              Open
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          ))}

        {admin && <StatusPill status={product.status} accent={product.accent} />}
      </div>
    </div>
  );
}

function StatusPill({ status, accent }: { status: ProductStatus; accent: string }) {
  if (status === "live") {
    return (
      <span
        className="vl-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider"
        style={{ borderColor: `${accent}40`, background: `${accent}14`, color: accent }}
      >
        <span className="vl-pulse relative h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        Live
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span className="vl-mono inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-500 dark:text-amber-300">
        Beta
      </span>
    );
  }
  return (
    <span className="vl-mono inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      Soon
    </span>
  );
}

function IconBtn({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function stop(e: React.MouseEvent, fn: () => void) {
  e.stopPropagation();
  e.preventDefault();
  fn();
}

/* ------------------------------------------------------------------ *
 * Grid states
 * ------------------------------------------------------------------ */

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="vl-rise h-[210px] overflow-hidden rounded-2xl border border-border bg-card p-5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="vl-shimmer h-12 w-12 rounded-xl" />
          <div className="vl-shimmer mt-4 h-4 w-1/2 rounded" />
          <div className="vl-shimmer mt-3 h-3 w-full rounded" />
          <div className="vl-shimmer mt-2 h-3 w-4/5 rounded" />
          <div className="vl-shimmer mt-8 h-6 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h3 className="vl-head mt-4 text-lg font-semibold text-foreground">Couldn't load products</h3>
      <p className="vl-ui mt-1.5 max-w-sm text-sm text-muted-foreground">
        The product registry didn't respond. Check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="vl-ui mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

function EmptyState({
  query,
  admin,
  onClear,
  onAdd,
}: {
  query: string;
  admin: boolean;
  onClear: () => void;
  onAdd: () => void;
}) {
  const searching = query.trim().length > 0;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {searching ? <Search className="h-7 w-7" /> : <Inbox className="h-7 w-7" />}
      </span>
      <h3 className="vl-head mt-4 text-lg font-semibold text-foreground">
        {searching ? "No products match" : "No products yet"}
      </h3>
      <p className="vl-ui mt-1.5 max-w-sm text-sm text-muted-foreground">
        {searching
          ? `Nothing matches “${query}”. Try a different term.`
          : "Onboard your first product to populate the launcher."}
      </p>
      {searching ? (
        <button
          onClick={onClear}
          className="vl-ui mt-5 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Clear search
        </button>
      ) : (
        admin && (
          <button
            onClick={onAdd}
            className="vl-ui mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
            style={{ background: VOLT }}
          >
            <Sparkles className="h-4 w-4" />
            Onboard product
          </button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Confirm dialog
 * ------------------------------------------------------------------ */

function ConfirmDialog({
  product,
  onCancel,
  onConfirm,
}: {
  product: Product;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="vl-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="vl-scale relative w-full max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/12 text-destructive">
          <Trash2 className="h-6 w-6" />
        </span>
        <h3 className="vl-head mt-4 text-lg font-semibold text-foreground">Remove {product.name}?</h3>
        <p className="vl-ui mt-1.5 text-sm text-muted-foreground">
          This removes the product from the launcher for everyone in your organisation. This can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="vl-ui rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="vl-ui rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Onboard / edit modal
 * ------------------------------------------------------------------ */

interface FormState {
  name: string;
  tagline: string;
  category: string;
  status: ProductStatus;
  url: string;
  accent: string;
  icon: string;
  metricLabel: string;
  metricValue: string;
}

function emptyForm(): FormState {
  return {
    name: "",
    tagline: "",
    category: "Operations",
    status: "live",
    url: "https://",
    accent: ACCENT_SWATCHES[6],
    icon: "Boxes",
    metricLabel: "",
    metricValue: "",
  };
}

function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function ProductModal({
  initial,
  existingCategories,
  onClose,
  onSave,
}: {
  initial: Product | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          tagline: initial.tagline,
          category: initial.category,
          status: initial.status,
          url: initial.url,
          accent: initial.accent,
          icon: initial.icon,
          metricLabel: initial.metric?.label ?? "",
          metricValue: initial.metric?.value ?? "",
        }
      : emptyForm(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [iconQuery, setIconQuery] = useState("");
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return ICON_NAMES;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconQuery]);

  const validate = useCallback((f: FormState) => {
    const next: Record<string, string> = {};
    if (!f.name.trim()) next.name = "Product name is required.";
    if (!f.tagline.trim()) next.tagline = "A short tagline is required.";
    if (!f.category.trim()) next.category = "Category is required.";
    if (!f.url.trim()) next.url = "Landing page URL is required.";
    else if (!isValidUrl(f.url)) next.url = "Enter a valid http(s) URL.";
    if (f.metricValue && !f.metricLabel) next.metricLabel = "Add a label for the metric.";
    return next;
  }, []);

  useEffect(() => {
    if (touched) setErrors(validate(form));
  }, [form, touched, validate]);

  const submit = () => {
    setTouched(true);
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const product: Product = {
      id: initial?.id ?? slug(form.name),
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      category: form.category.trim(),
      status: form.status,
      url: form.url.trim(),
      accent: form.accent,
      icon: form.icon,
      hidden: initial?.hidden,
      metric:
        form.metricValue.trim() && form.metricLabel.trim()
          ? { label: form.metricLabel.trim(), value: form.metricValue.trim() }
          : undefined,
    };
    onSave(product);
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const PreviewIcon = resolveIcon(form.icon);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="vl-fade fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="vl-scale relative my-auto w-full max-w-2xl rounded-2xl border border-border bg-popover shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="vl-head text-lg font-semibold text-foreground">
              {initial ? "Edit product" : "Onboard new product"}
            </h2>
            <p className="vl-ui text-[13px] text-muted-foreground">
              {initial ? "Update how this product appears in the launcher." : "Add a product to the Voltline launcher."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          {/* Name */}
          <Field label="Product name" error={errors.name} className="sm:col-span-1">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Sentinel"
              className={inputCls(errors.name)}
            />
          </Field>

          {/* Category */}
          <Field label="Category" error={errors.category} className="sm:col-span-1">
            <input
              list="vl-categories"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="e.g. Operations"
              className={inputCls(errors.category)}
            />
            <datalist id="vl-categories">
              {Array.from(new Set([...CATEGORY_ORDER, ...existingCategories])).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          {/* Tagline */}
          <Field label="Tagline" error={errors.tagline} className="sm:col-span-2">
            <input
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="One crisp line describing the product"
              className={inputCls(errors.tagline)}
            />
          </Field>

          {/* URL */}
          <Field label="Landing page URL" error={errors.url} className="sm:col-span-2">
            <input
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://product.transvolt.io"
              className={inputCls(errors.url)}
            />
          </Field>

          {/* Status */}
          <Field label="Status" className="sm:col-span-2">
            <div className="flex gap-2">
              {(["live", "beta", "coming-soon"] as ProductStatus[]).map((s) => {
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={`vl-ui flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium capitalize transition ${
                      active
                        ? ""
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                    style={
                      active ? { borderColor: VOLT, background: `${VOLT}26`, color: VOLT } : undefined
                    }
                  >
                    {s.replace("-", " ")}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Accent */}
          <Field label="Accent color" className="sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <label
                className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border"
                style={{ background: form.accent }}
              >
                <input
                  type="color"
                  value={form.accent}
                  onChange={(e) => set("accent", e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Pick accent color"
                />
              </label>
              <input
                value={form.accent}
                onChange={(e) => set("accent", e.target.value)}
                className={`${inputCls()} vl-mono uppercase`}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("accent", c)}
                  className="h-6 w-6 rounded-full border-2 transition hover:scale-110"
                  style={{
                    background: c,
                    borderColor:
                      form.accent.toLowerCase() === c.toLowerCase()
                        ? "var(--color-foreground)"
                        : "transparent",
                  }}
                  aria-label={`Use ${c}`}
                />
              ))}
            </div>
          </Field>

          {/* Live preview */}
          <Field label="Preview" className="sm:col-span-1">
            <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl border"
                style={{ background: `${form.accent}1a`, borderColor: `${form.accent}33`, color: form.accent }}
              >
                <PreviewIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="vl-head truncate text-sm font-semibold text-foreground">
                  {form.name || "Product name"}
                </p>
                <p className="vl-ui truncate text-[11px] text-muted-foreground">
                  {form.category || "Category"} · {form.status}
                </p>
              </div>
            </div>
          </Field>

          {/* Icon picker */}
          <Field label="Icon" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder="Search icons…"
                className={`${inputCls()} pl-9`}
              />
            </div>
            <div className="mt-2.5 grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-border bg-muted/40 p-2 sm:grid-cols-10">
              {filteredIcons.map((name) => {
                const Ico = resolveIcon(name);
                const active = form.icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => set("icon", name)}
                    className={`flex aspect-square items-center justify-center rounded-lg border transition ${
                      active
                        ? ""
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    style={
                      active
                        ? { borderColor: `${form.accent}66`, background: `${form.accent}1f`, color: form.accent }
                        : undefined
                    }
                  >
                    <Ico className="h-4.5 w-4.5" />
                  </button>
                );
              })}
              {filteredIcons.length === 0 && (
                <p className="vl-ui col-span-full py-3 text-center text-xs text-muted-foreground">No icons found</p>
              )}
            </div>
          </Field>

          {/* Metric (optional) */}
          <Field label="Metric label (optional)" error={errors.metricLabel} className="sm:col-span-1">
            <input
              value={form.metricLabel}
              onChange={(e) => set("metricLabel", e.target.value)}
              placeholder="e.g. Active routes"
              className={inputCls(errors.metricLabel)}
            />
          </Field>
          <Field label="Metric value (optional)" className="sm:col-span-1">
            <input
              value={form.metricValue}
              onChange={(e) => set("metricValue", e.target.value)}
              placeholder="e.g. 1,284"
              className={`${inputCls()} vl-mono`}
            />
          </Field>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="vl-ui text-[12px] text-muted-foreground">
            {Object.keys(errors).length > 0 && touched ? (
              <span className="text-destructive">Resolve the highlighted fields.</span>
            ) : (
              "Changes apply to the launcher instantly."
            )}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="vl-ui rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="vl-ui inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition active:scale-[0.98]"
              style={{ background: `linear-gradient(180deg, ${VOLT}, #3f6fe0)`, boxShadow: `0 8px 24px -10px ${VOLT}` }}
            >
              <Check className="h-4 w-4" />
              {initial ? "Save changes" : "Add product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="vl-ui mb-1.5 block text-[12px] font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="vl-ui mt-1 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

function inputCls(error?: string) {
  return [
    "vl-ui h-10 w-full rounded-xl border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition",
    error ? "border-destructive/60 focus:border-destructive" : "border-border focus:border-ring focus:bg-muted/60",
  ].join(" ");
}

function slug(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "product";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ *
 * Styles (fonts, keyframes, reduced-motion) — theme aware
 * ------------------------------------------------------------------ */

function StyleInjector() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

      .vl-root { background-color: var(--color-background); font-family: 'Inter', system-ui, sans-serif; }
      .vl-head { font-family: 'Space Grotesk', system-ui, sans-serif; }
      .vl-ui { font-family: 'Inter', system-ui, sans-serif; }
      .vl-mono { font-family: 'Space Mono', ui-monospace, monospace; }

      .vl-backdrop {
        background:
          radial-gradient(900px 500px at 12% -8%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 60%),
          radial-gradient(700px 500px at 95% 0%, color-mix(in oklab, var(--color-primary) 7%, transparent), transparent 55%),
          var(--color-background);
      }

      .vl-card { will-change: transform; }
      .vl-card:hover {
        border-color: color-mix(in srgb, var(--accent) 45%, transparent);
        box-shadow:
          0 22px 48px -24px var(--accent),
          0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
      }
      .vl-card:focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
      }
      .vl-card:active { transform: translateY(-1px) scale(0.992); }
      .vl-dim { opacity: 0.62; filter: saturate(0.7); }
      .vl-dragover { border-color: ${VOLT}; box-shadow: 0 0 0 2px ${VOLT}55; }

      .vl-sheen {
        background: linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--accent) 12%, transparent) 48%, transparent 66%);
        background-size: 250% 250%;
        opacity: 0;
        animation: vlSheen 7s ease-in-out infinite;
      }
      .vl-card:hover .vl-sheen { opacity: 1; }
      @keyframes vlSheen {
        0% { background-position: 200% 0%; opacity: 0; }
        45% { opacity: 0.9; }
        100% { background-position: -60% 0%; opacity: 0; }
      }

      .vl-rise { opacity: 0; animation: vlRise 0.5s cubic-bezier(0.22,0.61,0.36,1) forwards; }
      @keyframes vlRise {
        from { opacity: 0; transform: translateY(14px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .vl-pulse::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 9999px;
        background: inherit;
        opacity: 0.5;
        animation: vlPulse 1.8s ease-out infinite;
      }
      @keyframes vlPulse {
        0% { transform: scale(1); opacity: 0.55; }
        70% { transform: scale(2.6); opacity: 0; }
        100% { opacity: 0; }
      }

      .vl-shimmer {
        background: linear-gradient(90deg,
          color-mix(in oklab, var(--color-foreground) 5%, transparent) 25%,
          color-mix(in oklab, var(--color-foreground) 11%, transparent) 37%,
          color-mix(in oklab, var(--color-foreground) 5%, transparent) 63%);
        background-size: 400% 100%;
        animation: vlShimmer 1.4s ease infinite;
      }
      @keyframes vlShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

      .vl-spin-slow { animation: vlSpin 8s linear infinite; }
      @keyframes vlSpin { to { transform: rotate(360deg); } }

      .vl-fade { animation: vlFade 0.2s ease forwards; }
      @keyframes vlFade { from { opacity: 0; } to { opacity: 1; } }
      .vl-scale { animation: vlScale 0.22s cubic-bezier(0.22,0.61,0.36,1) forwards; }
      @keyframes vlScale { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .vl-pop { animation: vlScale 0.16s ease forwards; }
      .vl-toast { animation: vlToast 0.28s cubic-bezier(0.22,0.61,0.36,1) forwards; }
      @keyframes vlToast { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }

      @media (prefers-reduced-motion: reduce) {
        .vl-root *, .vl-root *::before, .vl-root *::after {
          animation: none !important;
          transition: none !important;
        }
        .vl-rise { opacity: 1 !important; transform: none !important; }
        .vl-card:hover { transform: none !important; }
        .vl-sheen { display: none !important; }
      }
    `}</style>
  );
}
