// ─── YLASPORT SERVICE WORKER ──────────────────────────────────────────────
// Cacheia imagens e vídeos do Supabase Storage para reduzir egress.
// Versão: atualiza esse número quando fizer deploy novo para limpar cache antigo.
const CACHE_NAME = 'ylasport-media-v1';

// Domínio do seu Supabase Storage
const SUPABASE_STORAGE = 'whzezjmjcnukixkkmyan.supabase.co';

// ─── INSTALL ──────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // Ativa imediatamente sem esperar fechar abas
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    // Remove caches antigos de versões anteriores
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('ylasport-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH: Estratégia Cache-First para imagens do Supabase ───────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Só intercepta requisições para o Supabase Storage (imagens/vídeos)
  if (!url.hostname.includes(SUPABASE_STORAGE)) return;
  if (!url.pathname.includes('/storage/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Verifica se já está no cache
      const cached = await cache.match(event.request);
      if (cached) {
        // Retorna do cache — ZERO egress consumido
        return cached;
      }

      // 2. Não está no cache: busca do Supabase e salva
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          // Salva no cache para próximas visitas
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        // Offline ou erro: retorna nada
        return new Response('', { status: 503 });
      }
    })
  );
});
