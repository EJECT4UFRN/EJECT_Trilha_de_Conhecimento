(function () {
	return; // SCRIPT DESATIVADO PARA EVITAR CONFLITOS DE BANCO DE DADOS
	// Evita múltiplas cargas do mesmo script
	if (window.__eject_progress_loaded) return;
	window.__eject_progress_loaded = true;

	// Utilitários
	const sanitizeId = (str) =>
		(str || '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/g, '') || 'untitled';

	const debounce = (fn, wait = 600) => {
		let t;
		return (...args) => {
			clearTimeout(t);
			t = setTimeout(() => fn(...args), wait);
		};
	};

	// Aguarda Firebase + Firestore prontos (até N tentativas)
	async function waitForFirestore(retries = 30, delay = 100) {
		for (let i = 0; i < retries; i++) {
			if (window.firebase && firebase.firestore && window.db) return window.db;
			await new Promise(r => setTimeout(r, delay));
		}
		throw new Error('Firestore não está disponível (timeout). Verifique se SDK foi carregado corretamente.');
	}

	// Injeta a UI de progresso em um card (versão melhorada)
	function injectProgressUI(card, initial = 0, disabled = true) {
		if (!card) return null;
		
		// evita duplicar - verifica se já existe
		const existing = card.querySelector('.eject-progress-wrap');
		if (existing) {
			const existingRange = existing.querySelector('.progress-range');
			const updateVisual = (v) => {
				const fill = existing.querySelector('.progress-fill');
				const percent = existing.querySelector('.progress-percent');
				if (fill) fill.style.width = v + '%';
				if (percent) percent.textContent = v + '%';
				if (existingRange) existingRange.value = v;
			};
			return { range: existingRange, updateVisual };
		}

		const wrap = document.createElement('div');
		wrap.className = 'eject-progress-wrap mt-3 w-full px-1';

		wrap.innerHTML = `
			<div class="mb-2">
				<div class="flex justify-between items-center mb-1">
					<span class="text-xs font-medium text-eject-text-primary-light dark:text-eject-text-primary-dark">Progresso</span>
					<span class="progress-percent text-xs font-medium text-eject-text-primary-light dark:text-eject-text-primary-dark">${initial}%</span>
				</div>
				<div class="progress-bar bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
					<div class="progress-fill bg-eject-button-gradient-light dark:bg-eject-button-gradient-dark h-full transition-all duration-300" style="width:${initial}%"></div>
				</div>
				<input type="range" min="0" max="100" value="${initial}" class="progress-range w-full mt-2 h-1" ${disabled ? 'disabled' : ''} />
			</div>
		`;

		// Procura o melhor local para inserir - tenta várias opções
		const possibleContainers = [
			card.querySelector('.p-4'),
			card.querySelector('.card-body'), 
			card.querySelector('[class*="p-"]'),
			card.querySelector('.flex-grow'),
			card
		];

		const container = possibleContainers.find(c => c !== null) || card;
		
		// Insere antes dos botões se possível
		const buttonContainer = container.querySelector('.mt-auto, .ds-btn-primary, .ds-btn-soon')?.parentElement;
		if (buttonContainer && container.contains(buttonContainer)) {
			container.insertBefore(wrap, buttonContainer);
		} else {
			container.appendChild(wrap);
		}

		const range = wrap.querySelector('.progress-range');
		const fill = wrap.querySelector('.progress-fill');
		const percent = wrap.querySelector('.progress-percent');

		const updateVisual = (v) => {
			if (fill) fill.style.width = v + '%';
			if (percent) percent.textContent = v + '%';
			if (range) range.value = v;
		};

		return { range, updateVisual };
	}

	// Descobre trilhas na página (versão melhorada)
	function discoverTracks() {
		const cards = Array.from(document.querySelectorAll('.ds-card'));
		console.log(`🔍 Descobrindo trilhas... encontrados ${cards.length} cards`);
		
		return cards.map((card, index) => {
			// Tenta várias fontes para o ID da trilha
			const explicit = card.getAttribute('data-track-title') || card.dataset.trackTitle;
			const h3Text = card.querySelector('h3')?.textContent;
			const imgAlt = card.querySelector('img')?.alt;
			const linkHref = card.querySelector('a[href]')?.href;
			
			let idSource = explicit || h3Text || imgAlt || `trilha_${index}`;
			const trackId = sanitizeId(idSource);
			const title = (explicit || h3Text || imgAlt || `Trilha ${index + 1}`).trim();
			
			console.log(`📋 Trilha detectada: ${title} (ID: ${trackId})`);
			return { card, trackId, title };
		});
	}

	// Injeta UIs desabilitadas quando não há usuário ou erro
	function injectDisabledProgress() {
		console.log('🔒 Injetando barras de progresso desabilitadas');
		const tracks = discoverTracks();
		tracks.forEach((t) => {
			const ui = injectProgressUI(t.card, 0, true);
			if (ui) {
				console.log(`➕ Barra desabilitada adicionada para: ${t.title}`);
			}
		});
	}

	// Anexa listener que salva no Firestore (debounced)
	function attachSaveHandler(track, ui, uid, firestore) {
		if (!ui || !ui.range) return;
		
		const docRef1 = firestore.collection('user_progress').doc(uid).collection('tracks').doc(track.trackId);
		const docRef2 = firestore.collection('users').doc(uid).collection('progress').doc(track.trackId);

		const save = debounce(async (value) => {
			const payload = {
				progress: Number(value),
				title: track.title,
				trackId: track.trackId,
				updatedAt: firebase.firestore.FieldValue.serverTimestamp()
			};
			try {
				await Promise.all([
					docRef1.set(payload, { merge: true }),
					docRef2.set(payload, { merge: true })
				]);
				console.log(`💾 Progresso salvo [${track.title}] = ${value}%`);
			} catch (err) {
				console.error('❌ Erro ao salvar progresso:', err);
			}
		}, 600);

		ui.range.addEventListener('input', (e) => {
			const v = Number(e.target.value);
			ui.updateVisual(v);
			save(v);
		});
	}

	// Carrega progresso do Firestore para o usuário e anexa handlers
	async function loadUserProgress(uid, firestore) {
		const tracks = discoverTracks();
		if (!tracks.length) {
			console.log('⚠️ Nenhuma trilha encontrada');
			return;
		}

		console.log(`👤 Carregando progresso para usuário: ${uid}`);
		
		try {
			// Lê todo o progresso do usuário de uma vez
			const colRef = firestore.collection('user_progress').doc(uid).collection('tracks');
			const snap = await colRef.get();
			const saved = {};
			snap.forEach((d) => (saved[d.id] = d.data()));

			console.log(`📊 ${snap.size} registros de progresso encontrados`);

			// Preenche cada trilha
			tracks.forEach((t) => {
				const value = (saved[t.trackId] && Number(saved[t.trackId].progress)) || 0;
				const ui = injectProgressUI(t.card, value, false);
				if (ui) {
					ui.updateVisual(value);
					attachSaveHandler(t, ui, uid, firestore);
					console.log(`✅ Trilha configurada: ${t.title} (${value}%)`);
				} else {
					console.log(`❌ Falha ao injetar UI para: ${t.title}`);
				}
			});
		} catch (err) {
			console.error('❌ Erro ao carregar progresso:', err);
			// Fallback para trilhas desabilitadas
			injectDisabledProgress();
		}
	}

	// Observador de auth para carregar/injetar progresso corretamente
	async function setupAuthObserver() {
		console.log('🚀 Iniciando sistema de progresso...');
		
		let firestore;
		try {
			firestore = await waitForFirestore();
			console.log('✅ Firestore conectado');
		} catch (err) {
			console.error('❌ Firestore não disponível:', err);
			injectDisabledProgress();
			return;
		}

		// Estado inicial
		const user = firebase.auth().currentUser;
		if (user) {
			console.log('👤 Usuário já logado, carregando progresso...');
			loadUserProgress(user.uid, firestore);
		} else {
			console.log('🔒 Usuário não logado, injetando barras desabilitadas...');
			injectDisabledProgress();
		}

		// Observa mudanças de autenticação
		firebase.auth().onAuthStateChanged((u) => {
			if (u) {
				console.log('🔓 Usuário fez login, carregando progresso...');
				loadUserProgress(u.uid, firestore);
			} else {
				console.log('🔒 Usuário fez logout, desabilitando barras...');
				injectDisabledProgress();
			}
		});
	}

	// Inicialização quando DOM estiver pronto
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', setupAuthObserver);
	} else {
		// DOM já carregado, executa com pequeno delay para agudar outros scripts
		setTimeout(setupAuthObserver, 100);
	}
})();
