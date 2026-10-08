const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

class RolodexDeck extends HTMLElement {
  #index = 0;
  #cards: HTMLElement[] = [];
  #live: HTMLElement | null = null;
  #wheel = 0;
  #touch: { y: number; x: number } | null = null;

  connectedCallback(): void {
    this.#cards = [...this.querySelectorAll<HTMLElement>(".card")];
    this.#live = this.querySelector("[data-live]");
    const initial = this.dataset.initial;
    const fromHash = window.location.hash.replace(/^#/, "");
    const startId = fromHash || initial || this.#cards[0]?.dataset.aliasId;
    this.#index = Math.max(
      0,
      this.#cards.findIndex((card) => card.dataset.aliasId === startId),
    );
    this.#render(false);
    this.addEventListener("keydown", this.#onKey);
    this.addEventListener("wheel", this.#onWheel, { passive: false });
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", () => {
      this.#touch = null;
    });
    window.addEventListener("hashchange", this.#onHash);
    this.tabIndex = 0;
    this.setAttribute("role", "region");
    this.setAttribute("aria-roledescription", "carousel");
    this.setAttribute("aria-label", "Alias rolodex");
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this.#onKey);
    this.removeEventListener("wheel", this.#onWheel);
    this.removeEventListener("pointerdown", this.#onPointerDown);
    this.removeEventListener("pointerup", this.#onPointerUp);
    window.removeEventListener("hashchange", this.#onHash);
  }

  #onHash = (): void => {
    const id = window.location.hash.replace(/^#/, "");
    const next = this.#cards.findIndex((card) => card.dataset.aliasId === id);
    if (next >= 0) this.#go(next, false);
  };

  #onKey = (event: KeyboardEvent): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "j") {
      event.preventDefault();
      this.#go(this.#index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "k") {
      event.preventDefault();
      this.#go(this.#index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      this.#go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      this.#go(this.#cards.length - 1);
    }
  };

  #onWheel = (event: WheelEvent): void => {
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    this.#wheel += event.deltaY;
    if (this.#wheel > 80) {
      this.#wheel = 0;
      this.#go(this.#index + 1);
    } else if (this.#wheel < -80) {
      this.#wheel = 0;
      this.#go(this.#index - 1);
    }
  };

  #onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") return;
    this.#touch = { y: event.clientY, x: event.clientX };
  };

  #onPointerUp = (event: PointerEvent): void => {
    if (!this.#touch) return;
    const dy = event.clientY - this.#touch.y;
    const dx = event.clientX - this.#touch.x;
    this.#touch = null;
    if (Math.abs(dy) < 40 && Math.abs(dx) < 40) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      this.#go(dy < 0 ? this.#index + 1 : this.#index - 1);
    } else {
      this.#go(dx < 0 ? this.#index + 1 : this.#index - 1);
    }
  };

  #go(next: number, updateHash = true): void {
    if (this.#cards.length === 0) return;
    const wrapped = (next + this.#cards.length) % this.#cards.length;
    if (wrapped === this.#index) return;
    const previous = this.#cards[this.#index];
    this.#index = wrapped;
    this.#render(true, previous);
    const id = this.#cards[this.#index]?.dataset.aliasId;
    if (updateHash && id) {
      history.replaceState(null, "", `#${id}`);
    }
  }

  goTo(id: string): void {
    const next = this.#cards.findIndex((card) => card.dataset.aliasId === id);
    if (next >= 0) this.#go(next);
  }

  #render(animate: boolean, previous?: HTMLElement): void {
    const current = this.#cards[this.#index];
    if (!current) return;
    for (const card of this.#cards) {
      const on = card === current;
      card.classList.toggle("is-current", on);
      card.classList.remove("is-leaving");
      card.setAttribute("aria-hidden", on ? "false" : "true");
    }
    if (animate && previous && !REDUCED.matches) {
      previous.classList.add("is-leaving");
      window.setTimeout(() => previous.classList.remove("is-leaving"), 320);
    }
    const label = `${current.dataset.aliasId} card ${this.#index + 1} of ${this.#cards.length}`;
    if (this.#live) this.#live.textContent = label;
    this.querySelectorAll<HTMLButtonElement>("[data-dot]").forEach((dot, i) => {
      dot.setAttribute("aria-current", i === this.#index ? "true" : "false");
    });
  }
}

function showToast(message: string): void {
  const toast = document.querySelector("[data-toast]");
  if (!(toast instanceof HTMLElement)) return;
  toast.textContent = message;
  toast.classList.add("is-on");
  window.setTimeout(() => toast.classList.remove("is-on"), 1600);
}

async function share(button: HTMLButtonElement): Promise<void> {
  const url = button.dataset.shareUrl ?? window.location.href;
  const title = button.dataset.shareTitle ?? document.title;
  const text = button.dataset.shareText ?? title;
  const payload = { title, text, url };

  try {
    if (typeof navigator.share === "function") {
      const can = navigator.canShare ? navigator.canShare(payload) : true;
      if (can) {
        await navigator.share(payload);
        showToast("Shared");
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    showToast("Link copied");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Could not share");
    }
  }
}

document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest("[data-share-button]");
  if (button instanceof HTMLButtonElement) {
    void share(button);
  }
  const dot = (event.target as HTMLElement | null)?.closest("[data-dot]");
  if (dot instanceof HTMLButtonElement) {
    const id = dot.dataset.dot;
    const deck = document.querySelector("rolodex-deck");
    if (id && deck instanceof RolodexDeck) deck.goTo(id);
  }
});

if (!customElements.get("rolodex-deck")) {
  customElements.define("rolodex-deck", RolodexDeck);
}
