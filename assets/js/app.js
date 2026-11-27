/* =======================================================
           SPA ROUTER & INITIALIZATION
           ======================================================= */
        async function handleRoute() {
            const hash = window.location.hash || '#store';
            const storeApp = document.getElementById('storeApp');
            const adminApp = document.getElementById('adminApp');
            const body = document.getElementById('appBody');

            if (hash === '#admin') {
                storeApp.classList.add('hidden');
                const user = await getCurrentUser();
                if (!user || user.peran !== 'admin') {
                    adminApp.classList.add('hidden');
                    openAuth('admin');
                    return;
                }
                adminApp.classList.remove('hidden');
                body.className = "bg-slate-50 text-slate-800 antialiased min-h-screen transition-colors duration-300";
                
                await refreshAllUI();
                if(!revenueChartInstance) initCharts();
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('posDeliveryDate').value = today;
            } else {
                adminApp.classList.add('hidden');
                storeApp.classList.remove('hidden');
                body.className = "text-slate-800 antialiased relative bg-[#fafafa] transition-colors duration-300";
                
                renderCatalog('Semua');
                renderBuilderOptions();
                calculateCustomPrice();
                loadStorePromotions();
                loadPublicContent();
            }
            window.scrollTo(0,0);
        }

        window.addEventListener('hashchange', handleRoute);

        window.addEventListener('DOMContentLoaded', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('checkoutDate').min = tomorrow.toISOString().split('T')[0];
            document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener('change', updateQrisCheckoutPreview));
            document.getElementById('chkDeliveryMethod').addEventListener('change', updateQrisCheckoutPreview);

            setInterval(() => {
                const now = new Date();
                document.getElementById('liveClock').innerText = now.toLocaleTimeString('id-ID');
            }, 1000);

            document.getElementById('mobileMenuBtn').addEventListener('click', () => {
                document.getElementById('navMenu').classList.toggle('hidden');
            });
            document.getElementById('customerAccountButton').addEventListener('click', async () => {
                const user=await getCurrentUser();
                if(user) {
                    openAuth(user.peran==='admin'?'admin':'customer');
                    document.getElementById('authTitle').innerText='Akun '+user.nama;
                    document.getElementById('authHint').innerText=user.email+(user.peran==='admin'?' · Administrator':' · Pelanggan');
                    document.getElementById('authForm').classList.add('hidden'); document.getElementById('authToggle').classList.add('hidden'); document.getElementById('authLogout').classList.remove('hidden');
                    const orderPanel=document.getElementById('authOrders');
                    if(user.peran==='pelanggan') {
                        orderPanel.innerHTML='<h3 class="font-bold text-sm text-slate-800">Pesanan Saya</h3><p class="text-xs text-slate-500">Memuat pesanan…</p>';
                        orderPanel.classList.remove('hidden');
                        try {
                            const response=await fetch('/roos-fleur/api/orders_web.php',{credentials:'same-origin'}); const result=await response.json();
                            if(!response.ok||!result.status) throw new Error(result.message||'Pesanan tidak dapat dimuat.');
                            const mine=result.data.orders||[];
                            orderPanel.innerHTML='<h3 class="font-bold text-sm text-slate-800">Pesanan Saya</h3>'+(mine.length?mine.map(o=>`<div class="rounded-xl bg-slate-50 p-3 text-xs"><div class="flex justify-between gap-2"><b>${escapeHTML(o.nomor_pesanan)}</b><span class="text-blush-600 font-semibold">${escapeHTML(o.status_pesanan)}</span></div><p class="mt-1 text-slate-600">${escapeHTML((o.items||[]).map(i=>i.nama).join(', '))} · Kirim ${escapeHTML(o.tanggal_pengiriman)}</p><p class="text-slate-500">${escapeHTML(o.metode_pengiriman)} · Pembayaran: ${escapeHTML(o.status_pembayaran)}</p>${o.metode_pengiriman!=='Ambil Sendiri'?`<p class="mt-1 text-slate-600"><i class="fa-solid fa-truck mr-1 text-blush-500"></i>${o.nama_kurir?`Kurir: ${escapeHTML(o.nama_kurir)} · ${escapeHTML(o.telepon_kurir)}`:'Kurir belum ditugaskan'}</p>${o.catatan_pengiriman?`<p class="text-slate-500">Catatan: ${escapeHTML(o.catatan_pengiriman)}</p>`:''}`:''}<p class="text-slate-500">Total ${formatRp(o.total)}</p>${o.status_pembayaran==='Menunggu Pembayaran'?(o.metode_pembayaran==='QRIS / E-Wallet'?`<p class="mt-2 text-amber-700">Pembayaran QRIS menunggu pemeriksaan admin.</p><a href="uploads/qris-code.jpg" target="_blank" rel="noopener" class="mt-2 inline-block rounded-lg bg-blush-500 px-3 py-2 font-bold text-white">Lihat QRIS untuk ${formatRp(o.total)}</a>`:o.metode_pembayaran==='COD'?`<p class="mt-2 text-amber-700">Bayar tunai saat pesanan diterima.</p>`:`<p class="mt-2 text-amber-700">Metode pembayaran pesanan ini sudah tidak tersedia. Silakan hubungi admin.</p>`):''}</div>`).join(''):'<p class="text-xs text-slate-500">Belum ada pesanan.</p>');
                            mine.filter(o=>o.status_pesanan==='Selesai').forEach(o=>{const form=document.createElement('form');form.className='mt-2 grid grid-cols-[1fr_2fr_auto] gap-2';form.innerHTML=`<select class="rounded-lg border p-2 text-xs"><option>Pengembalian</option><option>Penukaran</option></select><input required minlength="10" maxlength="2000" class="rounded-lg border p-2 text-xs" placeholder="Alasan permintaan"><button class="rounded-lg bg-slate-800 px-2 text-xs font-bold text-white">Ajukan</button>`;form.onsubmit=e=>submitReturnRequest(e,o.id_pesanan);const card=[...orderPanel.children].find(el=>el.textContent.includes(o.nomor_pesanan));if(card)card.appendChild(form);});
                        } catch(err) { orderPanel.innerHTML=`<p class="text-xs text-rose-600">${escapeHTML(err.message)}</p>`; }
                        try{const requestData=await serviceRequest('my_returns',{},'GET');orderPanel.insertAdjacentHTML('beforeend',`<div class="mt-3 border-t pt-3"><h3 class="text-xs font-bold">Pengembalian &amp; Penukaran</h3>${requestData.requests.length?requestData.requests.map(r=>`<p class="mt-2 rounded-lg bg-amber-50 p-2 text-xs">${escapeHTML(r.nomor_pesanan)} · ${escapeHTML(r.jenis)} · ${escapeHTML(r.status)}${r.catatan_admin?`<br>Catatan admin: ${escapeHTML(r.catatan_admin)}`:''}</p>`).join(''):'<p class="mt-1 text-xs text-slate-500">Belum ada permintaan.</p>'}</div>`);}catch(_){}
                    }
                    orderPanel.classList.remove('hidden');
                    orderPanel.insertAdjacentHTML('beforeend', `<div class="mt-4 border-t pt-4"><h3 class="text-sm font-bold">Pengaturan Profil</h3><form onsubmit="saveCustomerProfile(event)" class="mt-2 grid gap-2"><input id="profileName" required maxlength="120" value="${escapeHTML(user.nama)}" class="rounded-lg border p-2 text-sm"><input id="profileEmail" required type="email" value="${escapeHTML(user.email)}" class="rounded-lg border p-2 text-sm"><input id="profilePhone" value="${escapeHTML(user.telepon||'')}" placeholder="Nomor telepon" class="rounded-lg border p-2 text-sm"><button class="rounded-lg bg-slate-800 p-2 text-sm font-bold text-white">Simpan Profil</button></form><label class="mt-3 flex items-center gap-2 text-xs"><input id="notificationPreference" type="checkbox" ${localStorage.getItem('roos_notify')!=='off'?'checked':''} onchange="localStorage.setItem('roos_notify',this.checked?'on':'off')">Terima preferensi notifikasi pesanan dan promo</label><form onsubmit="changeCustomerPassword(event)" class="mt-3 grid gap-2"><input required type="password" id="oldPassword" placeholder="Kata sandi saat ini" class="rounded-lg border p-2 text-sm"><input required minlength="8" type="password" id="newPassword" placeholder="Kata sandi baru (min. 8 karakter)" class="rounded-lg border p-2 text-sm"><button class="rounded-lg border p-2 text-sm font-bold">Ganti Kata Sandi</button></form></div>`);
                } else openAuth('customer');
            });
            getCurrentUser().then(user=>{ if(user) document.getElementById('customerAccountButton').querySelector('span').innerText=user.nama; });
            
            handleRoute();
            loadPublicContent();
        });

        /* =======================================================
           SHARED UTILITIES & FORMATTING
           ======================================================= */
        const formatRp = (val) => 'Rp ' + Number(val).toLocaleString('id-ID');
        const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const safeHandlerArg = (value) => escapeHTML(JSON.stringify(String(value ?? '')));
        let STORE_WHATSAPP_NUMBER = '62895392805478';
        let PUBLIC_STORE_SETTINGS = {nama_toko:'Roos & Fleur',email:'halo@roosfleur.test',telepon:'0895-3928-05478',alamat:'Hubungi admin untuk konfirmasi alamat toko.',biaya_kurir:'15000',metode_pembayaran:'QRIS / E-Wallet,COD'};

        function openStoreWhatsApp(topic = 'umum') {
            const phone = STORE_WHATSAPP_NUMBER.replace(/\D/g, '');
            if (!/^\d{8,15}$/.test(phone)) {
                showStoreToast('Nomor WhatsApp admin belum diatur.');
                return;
            }
            let message = 'Halo Roos & Fleur, saya ingin bertanya tentang buket dan pemesanan.';
            if (topic === 'custom') {
                const choice = calculateCustomPrice();
                message = [
                    'Halo Roos & Fleur, saya ingin konsultasi buket kustom.',
                    `Bunga: ${choice.flower.name} (${customState.qty} batang)`,
                    `Wrapping: ${choice.wrap.name}`,
                    `Pita: ${choice.ribbonName}`,
                    `Estimasi harga: ${formatRp(choice.grandTotal)}`
                ].join('\n');
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        }

        /* =======================================================
           STOREFRONT & SHARED CATALOG LOGIC
           ======================================================= */
        const DEFAULT_CATALOG = [
            { id: 'PRD-1', name: 'Birthday Sunshine', category: 'Ulang Tahun', price: 180000, desc: 'Buket bunga matahari ceria untuk hari spesial.', img: 'https://placehold.co/400x400/fef08a/854d0e?text=Buket+Matahari+Ultah', tag: 'Populer' },
            { id: 'PRD-2', name: 'Sweet 17 Pink Roses', category: 'Ulang Tahun', price: 250000, desc: 'Rangkaian mawar pink pastel lembut.', img: 'https://placehold.co/400x400/fbcfe8/db2777?text=Mawar+Pink+Ultah', tag: '' },
            { id: 'PRD-4', name: 'Graduation Bear & Roses', category: 'Wisuda', price: 285000, desc: 'Buket mawar dilengkapi boneka teddy wisuda.', img: 'https://placehold.co/400x400/bfdbfe/1d4ed8?text=Boneka+Wisuda+%2B+Mawar', tag: 'Best Seller' },
            { id: 'PRD-7', name: 'Endless Love Red Roses', category: 'Anniversary', price: 450000, desc: '20 tangkai mawar merah marun super premium.', img: 'https://placehold.co/400x400/fecdd3/be123c?text=Mawar+Merah+Anniv', tag: 'Premium' },
        ];

        let catalogProducts = JSON.parse(localStorage.getItem('roos_catalog_products')) || [];

        let authContext = 'customer';
        let authMode = 'login';
        let activeWebOrderId = null;
        let availablePromotions = [];
        let activePromotion = null;
        let activeStorePromotionIndex = 0;
        let storePromotionTimer = null;
        async function authRequest(payload) {
            const res = await fetch('/roos-fleur/api/auth.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), credentials: 'same-origin' });
            const result = await res.json();
            if (!res.ok || !result.status) throw new Error(result.message || 'Permintaan gagal.');
            return result.data || {};
        }
        async function ordersRequest(payload) {
            const res = await fetch('/roos-fleur/api/orders_web.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), credentials: 'same-origin' });
            const result = await res.json();
            if (!res.ok || !result.status) throw new Error(result.message || 'Permintaan pesanan gagal.');
            return result.data || {};
        }
        async function promotionRequest(payload = null, method = 'GET') {
            const options = {method, credentials:'same-origin', headers:{}};
            if (payload instanceof FormData) options.body = payload;
            else if (payload) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(payload); }
            const response = await fetch('/roos-fleur/api/promosi.php', options);
            const result = await response.json();
            if (!response.ok || !result.status) throw new Error(result.message || 'Promo gagal diproses.');
            return result.data || {};
        }
        async function getCurrentUser() {
            try { const r = await fetch('/roos-fleur/api/auth.php?action=me', {credentials:'same-origin'}); const d = await r.json(); return d.data?.user || null; } catch (_) { return null; }
        }
        function openAuth(context = 'customer') {
            authContext = context;
            authMode = context === 'admin' ? 'login' : 'login';
            if (!document.body.dataset.authModalOpen) { document.body.dataset.authPreviousOverflow = document.body.style.overflow; document.body.dataset.authModalOpen = 'true'; }
            document.body.style.overflow = 'hidden';
            document.getElementById('authModal').classList.remove('hidden');
            document.getElementById('authModal').classList.add('flex');
            document.getElementById('authModal').scrollTop = 0;
            document.getElementById('authForm').classList.remove('hidden');
            document.getElementById('authOrders').classList.add('hidden');
            document.getElementById('authMessage').classList.add('hidden');
            document.getElementById('authName').classList.add('hidden');
            document.getElementById('authName').required = false;
            document.getElementById('authPhone').classList.add('hidden');
            document.getElementById('authTitle').innerText = context === 'admin' ? 'Portal Admin' : 'Masuk Pelanggan';
            document.getElementById('authHint').innerText = context === 'admin' ? 'Masuk untuk membuka dashboard dan mengelola toko.' : 'Masuk untuk melanjutkan belanja. Belum punya akun? Daftar gratis.';
            document.getElementById('authPassword').placeholder = 'Kata sandi';
            document.getElementById('authPassword').minLength = context === 'admin' ? 12 : 8;
            document.getElementById('authSubmit').innerText = 'Masuk';
            document.getElementById('authToggle').classList.toggle('hidden', context === 'admin');
            document.getElementById('authLogout').classList.add('hidden');
            document.getElementById('authLogout').classList.add('hidden');
            if (context === 'admin') fetch('/roos-fleur/api/auth.php?action=me').then(r=>r.json()).then(r=>{ if(r.data?.admin_setup_required){ authMode='setup'; document.getElementById('authTitle').innerText='Buat Admin Pertama'; document.getElementById('authHint').innerText='Admin awal hanya dapat dibuat sekali. Gunakan email aktif dan kata sandi minimal 12 karakter.'; document.getElementById('authName').classList.remove('hidden'); document.getElementById('authName').required=true; document.getElementById('authPassword').minLength=12; document.getElementById('authSubmit').innerText='Buat Akun Admin'; }}).catch(()=>{});
        }
        function closeAuth() { document.getElementById('authModal').classList.add('hidden'); document.getElementById('authModal').classList.remove('flex'); if(document.body.dataset.authModalOpen){document.body.style.overflow=document.body.dataset.authPreviousOverflow||'';delete document.body.dataset.authPreviousOverflow;delete document.body.dataset.authModalOpen;} }
        let customerInfoPreviousFocus = null;
        function openCustomerInfo(topic) {
            const modal = document.getElementById('customerInfoModal');
            const title = document.getElementById('customerInfoTitle');
            const content = document.getElementById('customerInfoContent');
            const pages = {
                ordering: {
                    title: 'Cara Pemesanan',
                    html: `<ol class="space-y-4">${[
                        ['Pilih buket', 'Buka katalog, pilih produk yang Anda suka, lalu tekan tombol tambah ke keranjang. Anda juga bisa merakit buket kustom jika pilihan bunga yang tersedia sesuai kebutuhan.'],
                        ['Masuk atau daftar', 'Tekan ikon akun dan masuk sebagai pelanggan. Jika belum memiliki akun, pilih daftar pelanggan.'],
                        ['Isi detail pesanan', 'Buka keranjang dan lanjutkan checkout. Isi nomor telepon, nama penerima, alamat, tanggal pengiriman, metode pengiriman, dan pesan kartu bila diperlukan.'],
                        ['Pilih pembayaran dan buat pesanan', 'Pilih metode pembayaran yang tersedia, periksa total dan ongkir, lalu kirim pesanan. Pesanan akan tercatat di akun Anda dan dapat dilihat kembali melalui menu akun.'],
                        ['Pantau status', 'Untuk QRIS, pindai kode dan bayar sesuai jumlah pesanan. Admin akan memeriksa transaksi lalu memperbarui status pembayaran. Jika memilih COD, bayar tunai saat pesanan diterima.']
                    ].map((step, i) => `<li class="flex gap-4"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush-100 font-bold text-blush-600">${i + 1}</span><div><h3 class="font-bold text-slate-800">${step[0]}</h3><p class="mt-1">${step[1]}</p></div></li>`).join('')}</ol><p class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><i class="fa-solid fa-circle-info mr-2"></i>Pastikan nama, nomor telepon, alamat, dan tanggal sudah benar sebelum mengirim pesanan.</p>`
                },
                shipping: {
                    title: 'Kebijakan Pengiriman',
                    html: `<div class="space-y-5"><p>Silakan pilih salah satu cara menerima pesanan saat checkout:</p><div class="grid gap-4 sm:grid-cols-2"><article class="rounded-2xl border border-blush-100 bg-blush-50/70 p-5"><div class="mb-2 flex items-center gap-2 font-bold text-slate-800"><i class="fa-solid fa-truck-fast text-blush-500"></i> Kurir Toko</div><p>Ongkir kurir saat ini <strong>${formatRp(Number(PUBLIC_STORE_SETTINGS.biaya_kurir||0))}</strong> per pesanan. Admin perlu mengonfirmasi alamat dan ketersediaan jadwal sebelum pesanan diproses.</p></article><article class="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div class="mb-2 flex items-center gap-2 font-bold text-slate-800"><i class="fa-solid fa-store text-blush-500"></i> Ambil Sendiri</div><p>Ongkir Rp 0. Tunggu konfirmasi admin bahwa buket sudah siap sebelum datang mengambil pesanan.</p></article></div><div><h3 class="font-bold text-slate-800">Jadwal dan status</h3><p class="mt-1">Pilih tanggal pengiriman yang tersedia di formulir checkout. Perubahan jadwal, kondisi lalu lintas, dan ketersediaan kurir dapat memengaruhi waktu tiba. Pantau status pesanan melalui menu akun pelanggan.</p></div><p class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><i class="fa-solid fa-circle-info mr-2"></i>Biaya tetap dan cakupan kurir pada halaman ini adalah pengaturan demo aplikasi. Konfirmasikan alamat dan ongkir akhir dengan admin sebelum pesanan dianggap siap dikirim.</p></div>`
                },
                faq: {
                    title: 'Pertanyaan yang Sering Diajukan',
                    html: `<div class="space-y-3">${[
                        ['Bagaimana cara mengetahui pesanan saya sudah tercatat?', 'Setelah checkout berhasil, pesanan tersimpan dan dapat dilihat di menu akun pelanggan pada bagian Pesanan Saya.'],
                        ['Apa metode pembayaran yang tersedia?', 'Tersedia QRIS dan COD. Pembayaran QRIS diperiksa admin secara manual; pembayaran COD dilakukan saat pesanan diterima.'],
                        ['Berapa ongkir yang dikenakan?', `Kurir Toko memiliki ongkir ${formatRp(Number(PUBLIC_STORE_SETTINGS.biaya_kurir||0))} dan Ambil Sendiri Rp 0. Admin tetap perlu mengonfirmasi alamat dan jadwal.`],
                        ['Bisakah saya mengubah alamat atau tanggal setelah checkout?', 'Hubungi admin sebelum pesanan diproses. Aplikasi belum menyediakan fitur ubah pesanan oleh pelanggan.'],
                        ['Bagaimana jika foto produk berbeda dengan buket yang diterima?', 'Foto katalog adalah referensi tampilan. Untuk tugas/demo, gunakan foto yang sesuai dengan produk yang Anda masukkan dan konfirmasikan detail produk sebelum pesanan diproses.'],
                        ['Apakah saya harus memiliki akun?', 'Akun pelanggan diperlukan untuk checkout dan melihat status pesanan.']
                    ].map((item, i) => `<details class="group rounded-2xl border border-slate-200 bg-white"><summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-semibold text-slate-800"><span>${item[0]}</span><i class="fa-solid fa-chevron-down text-xs text-blush-500 transition-transform group-open:rotate-180"></i></summary><p class="px-4 pb-4">${item[1]}</p></details>`).join('')}</div>`
                },
                about: { title: 'Tentang Roos & Fleur', html: `<div class="space-y-5"><p>Roos &amp; Fleur adalah toko bunga yang membantu Anda menyampaikan perhatian melalui rangkaian bunga segar untuk berbagai momen.</p><div class="grid gap-4 sm:grid-cols-2"><article class="rounded-2xl bg-blush-50 p-5"><h3 class="font-bold text-slate-800">Visi</h3><p class="mt-2">Menjadi florist pilihan untuk momen berharga dengan rangkaian yang indah dan layanan yang hangat.</p></article><article class="rounded-2xl bg-slate-50 p-5"><h3 class="font-bold text-slate-800">Misi</h3><p class="mt-2">Menghadirkan bunga berkualitas, pilihan personal, dan proses pemesanan yang mudah.</p></article></div></div>` },
                contact: { title: 'Kontak Kami', html: `<div class="space-y-4"><p>Tim ${escapeHTML(PUBLIC_STORE_SETTINGS.nama_toko)} siap membantu pertanyaan tentang produk dan pesanan.</p><div class="rounded-2xl border border-slate-200 p-5"><p><i class="fa-brands fa-whatsapp mr-2 text-emerald-600"></i>WhatsApp: ${escapeHTML(PUBLIC_STORE_SETTINGS.telepon)}</p><p class="mt-3"><i class="fa-regular fa-envelope mr-2 text-blush-500"></i>Email: ${escapeHTML(PUBLIC_STORE_SETTINGS.email)}</p><p class="mt-3"><i class="fa-solid fa-location-dot mr-2 text-blush-500"></i>Alamat: ${escapeHTML(PUBLIC_STORE_SETTINGS.alamat)}</p></div>${PUBLIC_STORE_SETTINGS.alamat&&PUBLIC_STORE_SETTINGS.alamat!=='Hubungi admin untuk konfirmasi alamat toko.'?`<iframe title="Peta lokasi toko" class="h-56 w-full rounded-2xl border" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(PUBLIC_STORE_SETTINGS.alamat)}&output=embed"></iframe>`:''}<button onclick="closeCustomerInfo();openStoreWhatsApp('umum')" class="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"><i class="fa-brands fa-whatsapp mr-2"></i>Chat WhatsApp</button></div>` },
                terms: { title: 'Syarat dan Ketentuan', html: `<div class="space-y-4"><p>Dengan menggunakan toko Roos &amp; Fleur, pelanggan menyetujui ketentuan berikut.</p><ol class="list-decimal space-y-2 pl-5"><li>Pastikan data penerima, nomor telepon, alamat, dan tanggal pengiriman benar sebelum checkout.</li><li>Pesanan diproses setelah ketersediaan produk dan detail pengiriman dikonfirmasi admin.</li><li>Foto produk merupakan referensi; variasi kecil pada bunga segar dan rangkaian dapat terjadi.</li><li>Perubahan atau pembatalan pesanan harus dikomunikasikan kepada admin secepatnya.</li><li>Pembayaran tersedia melalui QRIS yang diverifikasi admin atau COD yang dibayar saat pesanan diterima.</li></ol></div>` },
                privacy: { title: 'Kebijakan Privasi', html: `<div class="space-y-4"><p>Informasi akun dan pesanan digunakan untuk menjalankan layanan toko, menghubungi pelanggan, serta menampilkan riwayat pesanan pada akun.</p><ul class="list-disc space-y-2 pl-5"><li>Data yang diminta mencakup nama, email, nomor telepon, alamat penerima, dan rincian pesanan.</li><li>Akses data pesanan dibatasi untuk pelanggan terkait dan administrator toko.</li><li>Jangan gunakan data pribadi sungguhan saat demo atau presentasi kelas.</li><li>Hubungi admin jika memerlukan bantuan terkait informasi pesanan Anda.</li></ul></div>` }
            };
            const page = pages[topic] || pages.faq;
            customerInfoPreviousFocus = document.activeElement;
            title.textContent = page.title;
            content.innerHTML = page.html;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('overflow-hidden');
            modal.querySelector('button[aria-label="Tutup"]').focus();
        }

        function toggleWishlist(productId, name) {
            const ids = JSON.parse(localStorage.getItem('roos_wishlist') || '[]').map(String);
            const key = String(productId);
            const next = ids.includes(key) ? ids.filter(id => id !== key) : [...ids, key];
            localStorage.setItem('roos_wishlist', JSON.stringify(next));
            showStoreToast(next.includes(key) ? `${name} disimpan ke wishlist.` : `${name} dihapus dari wishlist.`);
            renderCatalog(window.roosWishlistOnly ? 'Wishlist' : (window.roosActiveCategory || 'Semua'));
        }
        function showWishlist() {
            window.roosWishlistOnly = true;
            renderCatalog('Wishlist');
            document.getElementById('katalog')?.scrollIntoView({behavior:'smooth'});
        }
        function resetWishlistView() {
            window.roosWishlistOnly = false;
            renderCatalog('Semua');
        }
        function closeCustomerInfo() {
            const modal = document.getElementById('customerInfoModal');
            if (!modal || modal.classList.contains('hidden')) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('overflow-hidden');
            if (customerInfoPreviousFocus && typeof customerInfoPreviousFocus.focus === 'function') customerInfoPreviousFocus.focus();
        }
        async function serviceRequest(action, payload = {}, method = 'POST') {
            const options = { method, credentials: 'same-origin', headers: {} };
            if (method === 'POST') { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({action, ...payload}); }
            const response = await fetch(`/roos-fleur/api/customer_services.php${method === 'GET' ? `?action=${encodeURIComponent(action)}` : ''}`, options);
            const result = await response.json(); if (!response.ok || !result.status) throw new Error(result.message || 'Permintaan gagal.'); return result.data || {};
        }
        async function trackPublicOrder(event) { event.preventDefault(); const box=document.getElementById('trackOrderResult');box.innerHTML='<p class="text-slate-500">Mencari pesanan…</p>';try{const params=new URLSearchParams({action:'track',order:document.getElementById('trackOrderNumber').value.trim(),phone:document.getElementById('trackOrderPhone').value.trim()});const response=await fetch(`/roos-fleur/api/customer_services.php?${params}`);const result=await response.json();if(!response.ok||!result.status)throw new Error(result.message);const o=result.data.order;box.innerHTML=`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><b>${escapeHTML(o.nomor_pesanan)}</b><p class="mt-1">Status: <strong>${escapeHTML(o.status_pesanan)}</strong></p><p>Pembayaran: ${escapeHTML(o.status_pembayaran)} · Kirim: ${escapeHTML(o.tanggal_pengiriman)}</p>${o.nama_kurir?`<p>Kurir: ${escapeHTML(o.nama_kurir)} · ${escapeHTML(o.telepon_kurir)}</p>`:''}${o.catatan_pengiriman?`<p>Catatan: ${escapeHTML(o.catatan_pengiriman)}</p>`:''}</div>`;}catch(error){box.innerHTML=`<p class="text-rose-600">${escapeHTML(error.message)}</p>`;}}
        async function submitContactMessage(event) { event.preventDefault();try{await serviceRequest('contact',{nama:document.getElementById('contactName').value,email:document.getElementById('contactEmail').value,pesan:document.getElementById('contactMessage').value});event.target.reset();showStoreToast('Pesan terkirim ke admin.');}catch(error){showStoreToast(error.message);}}
        async function submitPublicReview(event) { event.preventDefault();try{await serviceRequest('review',{rating:Number(document.getElementById('publicReviewRating').value),isi:document.getElementById('publicReviewText').value});event.target.reset();showStoreToast('Ulasan dikirim untuk moderasi.');}catch(error){showStoreToast(error.message);}}
        async function submitReturnRequest(event,id){event.preventDefault();const form=event.currentTarget;try{await serviceRequest('return_request',{id_pesanan:id,jenis:form.querySelector('select').value,alasan:form.querySelector('input').value});form.innerHTML='<span class="col-span-3 text-emerald-700">Permintaan terkirim.</span>';}catch(error){showStoreToast(error.message);}}
        async function saveCustomerProfile(event){event.preventDefault();try{const data=await authRequest({action:'profile_update',nama:profileName.value,email:profileEmail.value,telepon:profilePhone.value});showStoreToast('Profil tersimpan.');document.getElementById('customerAccountButton').querySelector('span').innerText=data.user.nama;}catch(e){showStoreToast(e.message);}}
        async function changeCustomerPassword(event){event.preventDefault();try{await authRequest({action:'password_update',password_lama:oldPassword.value,password_baru:newPassword.value});event.target.reset();showStoreToast('Kata sandi berhasil diganti.');}catch(e){showStoreToast(e.message);}}
        async function loadPublicContent() { try{const [reviews,articles,settings]=await Promise.all([serviceRequest('reviews',{},'GET'),serviceRequest('blog',{},'GET'),serviceRequest('store_settings',{},'GET')]);if(location.hash!=='#admin')serviceRequest('visit',{},'GET').catch(()=>{});PUBLIC_STORE_SETTINGS=settings.settings;STORE_WHATSAPP_NUMBER=String(settings.settings.telepon||'').replace(/\D/g,'').replace(/^0/,'62');const logo=document.getElementById('storeLogoImage');const logoIcon=document.getElementById('storeLogoIcon');if(settings.settings.logo_url){logo.src=settings.settings.logo_url;logo.classList.remove('hidden');logoIcon.classList.add('hidden');}const favicon=document.getElementById('storeFavicon');if(settings.settings.favicon_url)favicon.href=settings.settings.favicon_url;const brand=document.querySelector('#navbar .font-playfair');if(brand)brand.textContent=settings.settings.nama_toko||'Roos & Fleur';const activeMethods=String(settings.settings.metode_pembayaran||'').split(',').map(x=>x.trim());document.querySelectorAll('input[name="paymentMethod"]').forEach(input=>{const visible=activeMethods.includes(input.value);input.closest('.relative').classList.toggle('hidden',!visible);input.disabled=!visible;});if(document.querySelector('input[name="paymentMethod"]:checked')?.disabled){const next=[...document.querySelectorAll('input[name="paymentMethod"]')].find(x=>!x.disabled);if(next)next.checked=true;updateQrisCheckoutPreview();}if(typeof updateStoreCartUI==='function')updateStoreCartUI();if(typeof updateAdminCartUI==='function')updateAdminCartUI();const rv=document.getElementById('publicReviews');rv.innerHTML=reviews.reviews.length?reviews.reviews.map(r=>`<article class="rounded-xl border border-blush-100 bg-white p-4"><p class="text-amber-500">${'★'.repeat(Number(r.rating))}${'☆'.repeat(5-Number(r.rating))}</p><p class="mt-1 text-sm text-slate-700">“${escapeHTML(r.isi)}”</p><p class="mt-2 text-xs font-semibold text-slate-500">${escapeHTML(r.nama)}</p></article>`).join(''):'<p class="rounded-xl bg-white p-4 text-sm text-slate-500">Belum ada ulasan yang diterbitkan.</p>';const blog=document.getElementById('publicArticles');blog.innerHTML=articles.articles.length?articles.articles.map(a=>`<article class="rounded-xl border border-slate-100 bg-white p-4"><h3 class="font-bold">${escapeHTML(a.judul)}</h3><p class="mt-1 text-sm text-slate-600">${escapeHTML(a.ringkasan)}</p><details class="mt-2 text-sm"><summary class="cursor-pointer font-semibold text-blush-600">Baca artikel</summary><p class="mt-2 whitespace-pre-line text-slate-600">${escapeHTML(a.isi)}</p></details></article>`).join(''):'<p class="rounded-xl bg-white p-4 text-sm text-slate-500">Artikel baru akan tampil di sini.</p>';}catch(e){console.warn('Konten toko belum tersedia',e);}}
        async function loadAdminServices() { try{const data=await serviceRequest('admin',{},'GET');document.getElementById('settingStoreName').value=data.settings.nama_toko||'';document.getElementById('settingStoreEmail').value=data.settings.email||'';document.getElementById('settingStorePhone').value=data.settings.telepon||'';document.getElementById('settingStoreAddress').value=data.settings.alamat||'';document.getElementById('settingDeliveryFee').value=data.settings.biaya_kurir||'0';document.getElementById('settingLogoUrl').value=data.settings.logo_url||'';document.getElementById('settingFaviconUrl').value=data.settings.favicon_url||'';document.getElementById('settingPaymentMethods').value='QRIS, COD';document.getElementById('analyticsVisitors').textContent=data.analytics.pengunjung_hari_ini;document.getElementById('analyticsSales').textContent=formatRp(data.analytics.penjualan_lunas);document.getElementById('analyticsBestSeller').textContent=data.analytics.produk_terlaris;document.getElementById('analyticsUnits').textContent=`${data.analytics.terjual} unit terjual`;document.getElementById('adminContactMessages').innerHTML=data.messages.length?data.messages.map(m=>`<div class="rounded-xl border p-3"><b>${escapeHTML(m.nama)}</b><p class="text-xs text-slate-500">${escapeHTML(m.email)} · ${escapeHTML(m.dibuat_pada)}</p><p class="mt-2 whitespace-pre-line">${escapeHTML(m.pesan)}</p></div>`).join(''):'Belum ada pesan masuk.';document.getElementById('adminReturnRequests').innerHTML=data.returns.length?data.returns.map(r=>`<div class="rounded-xl border p-3"><b>${escapeHTML(r.jenis)} · ${escapeHTML(r.nomor_pesanan)}</b><p>${escapeHTML(r.nama_pelanggan)} · ${escapeHTML(r.alasan)}</p><p>Status: ${escapeHTML(r.status)}</p><div class="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><select id="returnStatus${r.id}" class="rounded border p-1"><option>Disetujui</option><option>Ditolak</option><option>Selesai</option></select><input id="returnNote${r.id}" value="${escapeHTML(r.catatan_admin||'')}" placeholder="Catatan admin" class="rounded border p-1"><button onclick="updateReturnRequest(${r.id})" class="rounded bg-slate-900 px-3 py-1 text-white">Simpan</button></div></div>`).join(''):'Belum ada permintaan.';document.getElementById('adminReviewList').innerHTML=data.reviews.length?data.reviews.map(r=>`<div class="rounded-xl border p-3"><b>${escapeHTML(r.nama)} · ${'★'.repeat(Number(r.rating))}</b><p>${escapeHTML(r.isi)}</p><p>Status: ${escapeHTML(r.status)}</p><button onclick="moderateReview(${r.id},'${r.status==='Tampil'?'Disembunyikan':'Tampil'}')" class="mt-2 rounded bg-blush-500 px-3 py-1 text-white">${r.status==='Tampil'?'Sembunyikan':'Terbitkan'}</button></div>`).join(''):'Belum ada ulasan.';document.getElementById('adminArticleList').innerHTML=data.articles.map(a=>`<p class="rounded border p-2"><b>${escapeHTML(a.judul)}</b> · ${escapeHTML(a.status)}</p>`).join('')||'Belum ada artikel.';await loadManagedUsers();await loadManagedCategories();}catch(error){document.getElementById('adminReturnRequests').textContent=error.message;}}
        async function saveStoreSettings(event){event.preventDefault();try{await serviceRequest('setting_update',{settings:{nama_toko:settingStoreName.value,email:settingStoreEmail.value,telepon:settingStorePhone.value,alamat:settingStoreAddress.value,biaya_kurir:settingDeliveryFee.value,logo_url:settingLogoUrl.value,favicon_url:settingFaviconUrl.value,metode_pembayaran:settingPaymentMethods.value}});showAdminToast('Pengaturan toko disimpan.');}catch(e){showAdminToast(e.message);}}
        async function saveBlogArticle(event){event.preventDefault();try{await serviceRequest('article_save',{judul:articleTitle.value,ringkasan:articleSummary.value,isi:articleContent.value,status:articleStatus.value});event.target.reset();await loadAdminServices();showAdminToast('Artikel disimpan.');}catch(e){showAdminToast(e.message);}}
        async function updateReturnRequest(id){try{await serviceRequest('return_update',{id,status:document.getElementById(`returnStatus${id}`).value,catatan_admin:document.getElementById(`returnNote${id}`).value});loadAdminServices();showAdminToast('Status permintaan diperbarui.');}catch(e){showAdminToast(e.message);}}
        async function moderateReview(id,status){try{await serviceRequest('review_update',{id,status});loadAdminServices();showAdminToast('Ulasan diperbarui.');}catch(e){showAdminToast(e.message);}}
        async function loadManagedUsers(){try{const data=await authRequest({action:'admin_users'});document.getElementById('adminUserList').innerHTML=data.users.map(u=>`<div class="flex items-center justify-between gap-2 rounded border p-2"><div><b>${escapeHTML(u.nama)}</b><p class="text-xs text-slate-500">${escapeHTML(u.email)} · ${escapeHTML(u.peran)}</p></div><div class="flex gap-2"><button onclick="editManagedUser(${u.id_akun},${safeHandlerArg(u.nama)},${safeHandlerArg(u.email)},${safeHandlerArg(u.telepon||'')},${safeHandlerArg(u.peran)})" class="text-blue-600" aria-label="Ubah pengguna"><i class="fa-solid fa-pen"></i></button><button onclick="deleteManagedUser(${u.id_akun})" class="text-rose-600" aria-label="Hapus pengguna"><i class="fa-solid fa-trash"></i></button></div></div>`).join('')||'Belum ada pengguna.';}catch(e){document.getElementById('adminUserList').textContent=e.message;}}
        function editManagedUser(id,name,email,phone,role){managedUserId.value=id;managedUserName.value=name;managedUserEmail.value=email;managedUserPhone.value=phone;managedUserRole.value=role;managedUserPassword.value='';managedUserSubmit.textContent='Simpan Perubahan';managedUserPassword.placeholder='Kosongkan saat memperbarui';managedUserName.scrollIntoView({behavior:'smooth',block:'center'});}
        async function saveManagedUser(event){event.preventDefault();if(!managedUserId.value&&!managedUserPassword.value){showAdminToast('Kata sandi awal wajib diisi.');return;}try{await authRequest({action:'admin_user_save',id_akun:managedUserId.value||0,nama:managedUserName.value,email:managedUserEmail.value,telepon:managedUserPhone.value,peran:managedUserRole.value,password:managedUserPassword.value});event.target.reset();managedUserId.value='';managedUserSubmit.textContent='Tambah Pengguna';managedUserPassword.placeholder='Kata sandi awal (wajib saat tambah)';await loadManagedUsers();showAdminToast('Data pengguna disimpan.');}catch(e){showAdminToast(e.message);}}
        async function deleteManagedUser(id){if(!confirm('Hapus akun pengguna ini?'))return;try{await authRequest({action:'admin_user_delete',id_akun:id});await loadManagedUsers();showAdminToast('Pengguna dihapus.');}catch(e){showAdminToast(e.message);}}
        async function loadManagedCategories(){try{const response=await fetch('/roos-fleur/api/categories.php',{credentials:'same-origin'});const data=await response.json();if(!response.ok||!data.status)throw new Error(data.message);document.getElementById('adminCategoryList').innerHTML=(data.data.categories||[]).map(c=>`<div class="flex items-center justify-between gap-2 rounded border p-2">${c.gambar_url?`<img src="${escapeHTML(c.gambar_url)}" class="h-10 w-10 rounded object-cover" alt="">`:''}<div class="min-w-0 flex-1"><b>${escapeHTML(c.nama)}</b><p class="truncate text-xs text-slate-500">${escapeHTML(c.deskripsi||'')}</p></div><button onclick="editCategory(${c.id},${safeHandlerArg(c.nama)},${safeHandlerArg(c.deskripsi||'')},${safeHandlerArg(c.gambar_url||'')})" class="text-blue-600" aria-label="Ubah kategori"><i class="fa-solid fa-pen"></i></button><button onclick="deleteCategory(${c.id})" class="text-rose-600" aria-label="Hapus kategori"><i class="fa-solid fa-trash"></i></button></div>`).join('')||'Belum ada kategori tersimpan.';}catch(e){document.getElementById('adminCategoryList').textContent=e.message;}}
        function editCategory(id,name,description,image){categoryId.value=id;categoryName.value=name;categoryDescription.value=description;categoryImage.value=image;}
        async function saveCategory(event){event.preventDefault();try{const response=await fetch('/roos-fleur/api/categories.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:categoryId.value||0,nama:categoryName.value,deskripsi:categoryDescription.value,gambar_url:categoryImage.value})});const data=await response.json();if(!response.ok||!data.status)throw new Error(data.message);event.target.reset();categoryId.value='';await loadManagedCategories();renderCatalog('Semua');showAdminToast('Kategori disimpan.');}catch(e){showAdminToast(e.message);}}
        async function deleteCategory(id){if(!confirm('Hapus kategori ini? Kategori yang masih dipakai produk tidak dapat dihapus.'))return;try{const response=await fetch('/roos-fleur/api/categories.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});const data=await response.json();if(!response.ok||!data.status)throw new Error(data.message);await loadManagedCategories();renderCatalog('Semua');showAdminToast('Kategori dihapus.');}catch(e){showAdminToast(e.message);}}
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeCustomerInfo();
        });
        function toggleAuthMode() {
            authMode = authMode === 'signup' ? 'login' : 'signup'; const signup = authMode === 'signup';
            document.getElementById('authName').classList.toggle('hidden', !signup); document.getElementById('authName').required=signup;
            document.getElementById('authPhone').classList.toggle('hidden', !signup);
            document.getElementById('authTitle').innerText=signup?'Daftar Pelanggan':'Masuk Pelanggan';
            document.getElementById('authSubmit').innerText=signup?'Buat Akun':'Masuk';
            document.getElementById('authToggle').innerText=signup?'Sudah punya akun? Masuk':'Buat akun pelanggan';
        }
        async function submitAuth(e) {
            e.preventDefault(); const msg=document.getElementById('authMessage'); msg.className='rounded-xl p-3 mb-4 text-sm bg-amber-50 text-amber-800'; msg.innerText='Memproses…';
            try {
                const data={action:authMode==='signup'?'register':authMode==='setup'?'setup_admin':'login', nama:document.getElementById('authName').value, email:document.getElementById('authEmail').value, telepon:document.getElementById('authPhone').value, password:document.getElementById('authPassword').value};
                const result=await authRequest(data); const user=result.user;
                closeAuth(); document.getElementById('customerAccountButton').querySelector('span').innerText=user.nama;
                if (authContext==='admin') { if(user.peran!=='admin') throw new Error('Akun ini bukan admin.'); handleRoute(); }
                else { showStoreToast('Berhasil masuk sebagai '+user.nama); }
            } catch(err) { msg.className='rounded-xl p-3 mb-4 text-sm bg-rose-50 text-rose-700'; msg.innerText=err.message; msg.classList.remove('hidden'); }
        }
        async function logoutUser() { try { await authRequest({action:'logout'}); closeAuth(); document.getElementById('customerAccountButton').querySelector('span').innerText='Akun Saya'; if(location.hash==='#admin') location.hash='#store'; } catch(e){ alert(e.message); } }
        function closeOrderSuccess(){document.getElementById('orderSuccessModal').classList.add('hidden');document.getElementById('qrisPaymentPanel').classList.add('hidden');}
        function openMyOrders(){closeOrderSuccess();document.getElementById('customerAccountButton').click();}

        const builderFlowers = [
            { id: 'F1', name: 'Mawar Merah', price: 15000, img: 'https://placehold.co/100/fecdd3/be123c?text=Mawar+Merah' },
            { id: 'F2', name: 'Mawar Putih', price: 16000, img: 'https://placehold.co/100/f1f5f9/64748b?text=Mawar+Putih' },
            { id: 'F3', name: 'Mawar Pink', price: 16000, img: 'https://placehold.co/100/fbcfe8/db2777?text=Mawar+Pink' },
        ];

        const builderWraps = [
            { id: 'W1', name: 'Soft Pink', price: 20000, color: '#fbcfe8' },
            { id: 'W2', name: 'Classic White', price: 18000, color: '#f8fafc' },
            { id: 'W3', name: 'Elegant Black', price: 22000, color: '#1e293b' },
        ];

        let storeCart = [];
        let activePromoCode = '';
        let customState = { flowerId: 'F1', qty: 5, wrapId: 'W1', ribbonInfo: 'Satin Pink|15000' };
        const JASA_RANGKAI = 35000;

        function filterCategory(category) {
            window.roosWishlistOnly = false;
            document.querySelectorAll('.nav-kategori').forEach(btn => {
                if (btn.innerText === category) {
                    btn.classList.add('text-blush-500', 'font-semibold'); btn.classList.remove('text-slate-600', 'font-medium');
                } else {
                    btn.classList.remove('text-blush-500', 'font-semibold'); btn.classList.add('text-slate-600', 'font-medium');
                }
            });

            document.querySelectorAll('.pill-btn').forEach(btn => {
                const selected = (btn.dataset.category || '') === category || btn.id === `pill-${category}`;
                btn.classList.remove('bg-slate-800','text-white','bg-white','text-slate-600','border','border-slate-200');
                btn.classList.add(...(selected ? ['bg-slate-800','text-white'] : ['bg-white','text-slate-600','border','border-slate-200']));
            });

            document.getElementById('catalogTitle').innerText = category === 'Semua' ? 'Koleksi Semua Buket' : `Koleksi Buket ${category}`;
            const catalogSection = document.getElementById('katalog');
            window.scrollTo({top: catalogSection.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth'});
            document.getElementById('mobileMenu').classList.add('hidden');
            renderCatalog(category);
        }

function renderCategoryFilters(products, selectedCategory, managedCategories = []) {
    const container=document.getElementById('catalogCategoryFilters');
    if(!container) return;
    const categories=[...new Set([...products.map(p=>String(p.kategori||'').trim()),...managedCategories.map(c=>String(c.nama||'').trim())].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
    container.innerHTML='';
    ['Semua',...categories,'Wishlist'].forEach((category,index)=>{
        const button=document.createElement('button');
        button.type='button'; button.className='pill-btn px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap shadow-sm transition-all';
        button.dataset.category=category; button.id=index===0?'pill-Semua':'pill-dynamic-'+index;
        button.textContent=category==='Semua'?'Semua Produk':category==='Wishlist'?'♡ Wishlist':category;
        button.classList.add(...(category===selectedCategory?['bg-slate-800','text-white']:['bg-white','text-slate-600','border','border-slate-200']));
        button.addEventListener('click',()=>category==='Wishlist'?showWishlist():filterCategory(category));
        container.appendChild(button);
    });
}

async function renderCatalog(category) {
    const grid = document.getElementById('productGrid');
    const emptyState = document.getElementById('emptyCatalog');

    if (!grid) return;

    grid.innerHTML = '';
    grid.classList.add('opacity-0');

    try {
        const response = await fetch('/roos-fleur/api/produk.php');

        if (!response.ok) {
            throw new Error('Gagal mengambil data produk');
        }

        const result = await response.json();

        if (!result.status || !result.data || !Array.isArray(result.data.produk)) {
            throw new Error('Format data produk tidak sesuai');
        }

        const apiProducts = Array.isArray(result.data.produk)
    ? result.data.produk
    : [];

// Katalog publik mengikuti data server agar produk demo lama yang tersimpan
// di browser tidak muncul tanpa bisa dikelola dari dashboard admin.
const products = apiProducts;
        let managedCategories=[];try{const categoryResponse=await fetch('/roos-fleur/api/categories.php');const categoryData=await categoryResponse.json();if(categoryData.status)managedCategories=categoryData.data.categories||[];}catch(_){}
        renderCategoryFilters(products, category, managedCategories);

        window.roosActiveCategory = category === 'Wishlist' ? (window.roosActiveCategory || 'Semua') : category;
        const wishlistIds = JSON.parse(localStorage.getItem('roos_wishlist') || '[]').map(String);
        const filtered = category === 'Wishlist'
            ? products.filter(p => wishlistIds.includes(String(p.id_produk)))
            : category === 'Semua' ? products : products.filter(p => p.kategori === category);
        const catalogTitle = document.getElementById('catalogTitle');
        if (catalogTitle) catalogTitle.textContent = category === 'Wishlist' ? 'Wishlist Saya' : `Koleksi ${category === 'Semua' ? 'Semua Buket' : category}`;

        if (filtered.length === 0) {
            grid.classList.add('hidden');

            if (emptyState) {
                emptyState.classList.remove('hidden');
            }

            return;
        }

        grid.classList.remove('hidden');

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        filtered.forEach(p => {
            let imageUrl = '';

            if (p.foto_url) {
                imageUrl = p.foto_url
                    .replace(/\\/g, '/');

                if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                    imageUrl = '/' + imageUrl;
                }
            }

            const imageHtml = imageUrl
                ? `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(p.nama_produk)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
                : `<div class="w-full h-full flex items-center justify-center bg-pink-50 text-pink-300 text-5xl">🌸</div>`;

            const price = Number(p.harga) || 0;
            const availableStock = Math.max(0, Number(p.stok) || 0);

            grid.innerHTML += `
                <div class="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden">

                    <div class="relative overflow-hidden aspect-square bg-slate-50">

                        ${imageHtml}

                        <div class="absolute top-3 left-3 bg-white/90 text-pink-600 px-3 py-1 rounded-full text-xs font-bold">
                            ${escapeHTML(p.kategori || 'Bunga')}
                        </div>

                        <button type="button" aria-label="${wishlistIds.includes(String(p.id_produk)) ? 'Hapus dari' : 'Simpan ke'} wishlist" onclick="toggleWishlist(${safeHandlerArg(p.id_produk)}, ${safeHandlerArg(p.nama_produk)})" class="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow hover:bg-rose-50"><i class="fa-${wishlistIds.includes(String(p.id_produk)) ? 'solid' : 'regular'} fa-heart"></i></button>
                        <div class="absolute bottom-16 left-3 rounded-full px-3 py-1 text-xs font-bold ${availableStock>0?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${availableStock>0?`Stok ${availableStock}`:'Stok habis'}</div>

                        <button
                            onclick="addToStoreCart(${safeHandlerArg(p.id_produk)}, ${safeHandlerArg(p.nama_produk)}, ${price}, ${safeHandlerArg(imageUrl)})"
                            ${availableStock<1?'disabled':''} class="absolute bottom-3 left-3 right-3 bg-white text-pink-600 font-bold py-3 rounded-xl shadow-lg hover:bg-pink-500 hover:text-white transition-all disabled:cursor-not-allowed disabled:opacity-50">
                            ${availableStock>0?'+ Keranjang':'Stok Habis'}
                        </button>

                    </div>

                    <div class="p-5 flex flex-col">

                        <h3 class="font-bold text-lg text-slate-800 mb-2">
                            ${escapeHTML(p.nama_produk)}
                        </h3>

                        <p class="text-sm text-slate-500 mb-4 line-clamp-2">
                            ${escapeHTML(p.deskripsi || 'Rangkaian bunga segar eksklusif untuk orang terkasih.')}
                        </p>

                        <div class="flex items-center justify-between mt-auto">

                            <span class="font-bold text-xl text-slate-900">
                                ${formatRp(price)}
                            </span>

                            <button
                                onclick="addToStoreCart(${safeHandlerArg(p.id_produk)}, ${safeHandlerArg(p.nama_produk)}, ${price}, ${safeHandlerArg(imageUrl)})"
                                ${availableStock<1?'disabled':''} class="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center hover:bg-pink-600 transition-all disabled:cursor-not-allowed disabled:opacity-50">
                                +
                            </button>

                        </div>

                    </div>

                </div>
            `;
        });

    } catch (error) {
        console.error('Gagal memuat katalog:', error);

        grid.innerHTML = `
            <div class="col-span-full text-center py-10">
                <p class="text-red-500 font-semibold">
                    Gagal memuat katalog produk.
                </p>
                <p class="text-slate-500 text-sm mt-2">
                    Pastikan server XAMPP dan API produk berjalan.
                </p>
            </div>
        `;
    }

    grid.classList.remove('opacity-0');
}
        function toggleMobileMenu() { document.getElementById('mobileMenu').classList.toggle('hidden'); }

        function renderBuilderOptions() {
            const fContainer = document.getElementById('builderFlowerOptions');
            if(!fContainer) return;
            fContainer.innerHTML = '';
            builderFlowers.forEach((f, idx) => {
                const isChecked = idx === 0 ? 'checked' : '';
                fContainer.innerHTML += `
                    <div class="relative">
                        <input type="radio" name="bFlower" id="${f.id}" value="${f.id}" class="peer hidden" onchange="updateCustomState('flowerId', '${f.id}')" ${isChecked}>
                        <label for="${f.id}" class="block cursor-pointer bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-blush-300 peer-checked:border-blush-500 peer-checked:ring-2 peer-checked:ring-blush-500 transition-all">
                            <img src="${f.img}" class="w-full h-16 object-cover">
                            <div class="p-2 text-center">
                                <p class="text-xs font-bold text-slate-700 truncate">${f.name}</p>
                                <p class="text-[10px] text-slate-500">${formatRp(f.price)}</p>
                            </div>
                        </label>
                    </div>
                `;
            });

            const wContainer = document.getElementById('builderWrapOptions');
            if(!wContainer) return;
            wContainer.innerHTML = '';
            builderWraps.forEach((w, idx) => {
                const isChecked = idx === 0 ? 'checked' : '';
                wContainer.innerHTML += `
                    <div class="relative flex flex-col items-center gap-1">
                        <input type="radio" name="bWrap" id="${w.id}" value="${w.id}" class="hidden radio-swatch" onchange="updateCustomState('wrapId', '${w.id}')" ${isChecked}>
                        <label for="${w.id}" class="w-10 h-10 rounded-full cursor-pointer shadow-inner border-2 border-white ring-2 ring-slate-200 transition-all block" style="background-color: ${w.color};"></label>
                        <span class="text-[10px] text-slate-500 font-medium">${w.name.split(' ')[0]}</span>
                    </div>
                `;
            });
        }

        function updateCustomQty(change) {
            let val = parseInt(document.getElementById('builderQty').value) + change;
            if(val < 1) val = 1; if(val > 50) val = 50;
            document.getElementById('builderQty').value = val;
            customState.qty = val; calculateCustomPrice();
        }

        function updateCustomState(key, val) { customState[key] = val; calculateCustomPrice(); }

        function calculateCustomPrice() {
            const ribbonEl = document.getElementById('builderRibbon');
            if(!ribbonEl) return {};
            customState.ribbonInfo = ribbonEl.value;
            const flower = builderFlowers.find(f => f.id === customState.flowerId);
            const wrap = builderWraps.find(w => w.id === customState.wrapId);
            const ribbonName = customState.ribbonInfo.split('|')[0];
            const ribbonPrice = parseInt(customState.ribbonInfo.split('|')[1]);
            const floralTotal = flower.price * customState.qty;
            const grandTotal = floralTotal + wrap.price + ribbonPrice + JASA_RANGKAI;

            document.getElementById('summaryFlowerName').innerText = flower.name;
            document.getElementById('summaryFlowerCalc').innerText = `${customState.qty} batang x ${formatRp(flower.price)}`;
            document.getElementById('summaryFlowerTotal').innerText = formatRp(floralTotal);
            document.getElementById('summaryWrapName').innerText = `Kertas: ${wrap.name}`;
            document.getElementById('summaryWrapPrice').innerText = formatRp(wrap.price);
            document.getElementById('summaryRibbonName').innerText = `Pita: ${ribbonName}`;
            document.getElementById('summaryRibbonPrice').innerText = formatRp(ribbonPrice);
            document.getElementById('summaryGrandTotal').innerText = formatRp(grandTotal);
            return { flower, wrap, ribbonName, ribbonPrice, grandTotal };
        }

        function addCustomToStoreCart() {
            const data = calculateCustomPrice();
            const item = {
                id: 'CSTM-' + Date.now(), name: `Custom: Buket ${data.flower.name}`,
                desc: `${customState.qty} Batang, Wrap ${data.wrap.name}, ${data.ribbonName}`,
                price: data.grandTotal, img: data.flower.img, isCustom: true,
                custom: { flowerId: customState.flowerId, qty: customState.qty, wrapId: customState.wrapId, ribbonName: data.ribbonName }
            };
            storeCart.push(item); updateStoreCartUI(); showStoreToast("Buket kustom berhasil ditambahkan ke keranjang!");
        }

        function addToStoreCart(id, name, price, img) {
            storeCart.push({ id, name, price, img, desc: 'Ready-made Bouquet', isCustom: false });
            updateStoreCartUI(); showStoreToast(`${name} berhasil ditambahkan!`);
        }

        function removeFromStoreCart(index) {
            storeCart.splice(index, 1); updateStoreCartUI();
        }

        function applyStorePromo() {
            const input = document.getElementById('promoCodeInput');
            const message = document.getElementById('promoMessage');
            const code = (input?.value || '').trim().toUpperCase();
            const subtotal = storeCart.reduce((sum, item) => sum + Number(item.price || 0), 0);
            const promo = availablePromotions.find(item => item.kode_promo === code && Number(item.aktif) === 1);
            if (!promo) {
                activePromoCode = '';
                message.innerText = 'Kode promo tidak ditemukan atau sedang tidak aktif.';
                message.className = 'mt-2 text-xs text-rose-600';
            } else if (subtotal < Number(promo.minimal_belanja || 0)) {
                activePromoCode = '';
                message.innerText = `Promo berlaku untuk subtotal minimal ${formatRp(Number(promo.minimal_belanja || 0))}.`;
                message.className = 'mt-2 text-xs text-rose-600';
            } else {
                activePromoCode = code;
                const cap = Number(promo.maksimal_diskon || 0);
                message.innerText = `Promo aktif: diskon ${Number(promo.diskon_persen)}%${cap > 0 ? ` (maksimal ${formatRp(cap)})` : ''}.`;
                message.className = 'mt-2 text-xs text-emerald-700';
            }
            updateStoreCartUI();
        }

        function getActivePromoDiscount(subtotal) {
            const promo = availablePromotions.find(item => item.kode_promo === activePromoCode && Number(item.aktif) === 1);
            if (!promo || subtotal < Number(promo.minimal_belanja || 0)) return 0;
            const discount = Math.round(subtotal * Number(promo.diskon_persen || 0) / 100);
            const cap = Number(promo.maksimal_diskon || 0);
            return cap > 0 ? Math.min(discount, cap) : discount;
        }

        function showStorePromotion(index) {
            const card = document.getElementById('storePromoCard');
            if (!availablePromotions.length) { card?.classList.add('hidden'); return; }
            activeStorePromotionIndex = (index + availablePromotions.length) % availablePromotions.length;
            activePromotion = availablePromotions[activeStorePromotionIndex];
            if (card && availablePromotions.length > 1) {
                card.classList.remove('promo-slide-next', 'promo-slide-prev');
                void card.offsetWidth;
                card.classList.add(index < activeStorePromotionIndex || (index < 0 && activeStorePromotionIndex === availablePromotions.length - 1) ? 'promo-slide-prev' : 'promo-slide-next');
            }
            card?.classList.remove('hidden');
            document.getElementById('storePromoTitle').textContent = activePromotion.judul;
            document.getElementById('storePromoDescription').textContent = activePromotion.deskripsi;
            document.getElementById('storePromoCode').textContent = activePromotion.kode_promo;
            document.getElementById('storePromoButtonText').textContent = activePromotion.teks_tombol || 'Pilih Buket Sekarang';
            const image = card?.querySelector('img');
            if (image) { image.src = activePromotion.gambar_url; image.alt = `Banner promo ${activePromotion.judul}`; }
            const hint = document.getElementById('checkoutPromoHint');
            if (hint) hint.textContent = `Promo ${activePromotion.kode_promo}: diskon ${Number(activePromotion.diskon_persen)}%${Number(activePromotion.maksimal_diskon) > 0 ? ` (maks. ${formatRp(Number(activePromotion.maksimal_diskon))})` : ''} untuk subtotal min. ${formatRp(Number(activePromotion.minimal_belanja))}.`;
            const controls = document.getElementById('storePromoControls');
            if (controls) controls.classList.toggle('hidden', availablePromotions.length < 2);
            const dots = document.getElementById('storePromoDots');
            if (dots) dots.innerHTML = availablePromotions.map((promo, i) => `<button type="button" onclick="showStorePromotion(${i})" aria-label="Tampilkan promo ${i + 1}: ${escapeHTML(promo.judul)}" aria-current="${i === activeStorePromotionIndex ? 'true' : 'false'}" class="h-2.5 rounded-full transition-all ${i === activeStorePromotionIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}"></button>`).join('');
        }

        function moveStorePromotion(direction) {
            if (availablePromotions.length < 2) return;
            showStorePromotion(activeStorePromotionIndex + direction);
            if (storePromotionTimer) clearInterval(storePromotionTimer);
            storePromotionTimer = window.setInterval(() => showStorePromotion(activeStorePromotionIndex + 1), 6000);
        }

        async function loadStorePromotions() {
            const card = document.getElementById('storePromoCard');
            try {
                const data = await promotionRequest();
                availablePromotions = Array.isArray(data.promosi) ? data.promosi : [];
                if (!availablePromotions.length) { card?.classList.add('hidden'); return; }
                showStorePromotion(0);
                if (storePromotionTimer) clearInterval(storePromotionTimer);
                storePromotionTimer = availablePromotions.length > 1
                    ? window.setInterval(() => showStorePromotion(activeStorePromotionIndex + 1), 6000)
                    : null;
                updateStoreCartUI();
            } catch (error) {
                console.warn('Promo tidak dapat dimuat:', error);
                availablePromotions = [];
                activePromotion = null;
                card?.classList.add('hidden');
                const hint = document.getElementById('checkoutPromoHint');
                if (hint) hint.textContent = 'Promo sedang tidak tersedia.';
            }
        }

        function updateStoreCartUI() {
            const container = document.getElementById('storeCartItemsContainer');
            const badge = document.getElementById('cartBadge');
            const btnCheckout = document.getElementById('btnCheckout');
            if(!container) return;
            
            badge.innerText = storeCart.length;
            if (storeCart.length > 0) {
                badge.classList.remove('hidden'); document.getElementById('emptyCartMsg').classList.add('hidden');
                btnCheckout.removeAttribute('disabled');
            } else {
                badge.classList.add('hidden'); document.getElementById('emptyCartMsg').classList.remove('hidden');
                btnCheckout.setAttribute('disabled', 'true');
            }

            container.innerHTML = '';
            let subtotal = 0;
            storeCart.forEach((item, index) => {
                subtotal += item.price;
                container.innerHTML += `
                    <div class="flex gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm relative group">
                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0"><img src="${item.img}" class="w-full h-full object-cover"></div>
                        <div class="flex-1 flex flex-col justify-center">
                            ${item.isCustom ? '<span class="text-[9px] font-bold text-blush-500 uppercase tracking-wider mb-1">Custom Order</span>' : ''}
                            <h4 class="font-bold text-sm text-slate-800 leading-tight">${item.name}</h4>
                            <p class="text-[10px] text-slate-500 line-clamp-2 mt-1">${item.desc}</p>
                            <span class="font-bold text-blush-600 text-sm mt-1">${formatRp(item.price)}</span>
                        </div>
                        <button onclick="removeFromStoreCart(${index})" class="absolute top-2 right-2 w-7 h-7 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                `;
            });
            if (subtotal < 100000) activePromoCode = '';
            const discount = getActivePromoDiscount(subtotal);
            const discountRow = document.getElementById('storeCartDiscountRow');
            discountRow.classList.toggle('hidden', discount === 0);
            document.getElementById('storeCartDiscountText').innerText = `- ${formatRp(discount)}`;
            document.getElementById('storeCartSubtotalText').innerText = formatRp(subtotal);
            document.getElementById('storeCartTotalText').innerText = formatRp(Math.max(0, subtotal - discount) + (storeCart.length>0?Number(PUBLIC_STORE_SETTINGS.biaya_kurir||0):0));
        }

        function toggleStoreCart() {
            const sidebar = document.getElementById('storeCartSidebar');
            const overlay = document.getElementById('storeOverlay');
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden'); overlay.classList.remove('hidden');
                setTimeout(() => { sidebar.classList.add('open'); overlay.classList.add('open'); }, 10);
            } else {
                sidebar.classList.remove('open'); overlay.classList.remove('open');
                setTimeout(() => { sidebar.classList.add('hidden'); overlay.classList.add('hidden'); }, 300);
            }
        }

        async function openCheckout() {
            if(storeCart.length === 0) return;
            const user = await getCurrentUser();
            if (!user || user.peran !== 'pelanggan') { openAuth('customer'); document.getElementById('authMessage').innerText='Masuk atau buat akun pelanggan sebelum checkout.'; document.getElementById('authMessage').classList.remove('hidden'); return; }
            document.getElementById('chkCustName').value = user.nama || '';
            document.getElementById('chkCustPhone').value = user.telepon || '';
            updateQrisCheckoutPreview();
            toggleStoreCart();
            setTimeout(() => {
                const modal = document.getElementById('checkoutModal');
                const overlay = document.getElementById('storeOverlay');
                modal.classList.remove('hidden'); overlay.classList.remove('hidden');
                setTimeout(() => { modal.classList.add('open'); overlay.classList.add('open'); }, 10);
            }, 350);
        }

        function closeStoreModals() {
            const sidebar = document.getElementById('storeCartSidebar');
            const checkout = document.getElementById('checkoutModal');
            const overlay = document.getElementById('storeOverlay');
            sidebar.classList.remove('open'); checkout.classList.remove('open'); overlay.classList.remove('open');
            setTimeout(() => { sidebar.classList.add('hidden'); checkout.classList.add('hidden'); overlay.classList.add('hidden'); }, 300);
        }

        function updateQrisCheckoutPreview() {
            const panel = document.getElementById('checkoutQrisPreview');
            if (!panel) return;
            const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')?.value;
            const showQris = selectedPayment === 'QRIS / E-Wallet';
            panel.classList.toggle('hidden', !showQris);
            if (!showQris) return;
            const subtotal = storeCart.reduce((sum, item) => sum + Number(item.price || 0), 0);
            const discount = getActivePromoDiscount(subtotal);
            const delivery = document.getElementById('chkDeliveryMethod').value;
            const shipping = delivery === 'Ambil Sendiri' ? 0 : Number(PUBLIC_STORE_SETTINGS.biaya_kurir||0);
            document.getElementById('checkoutQrisAmount').innerText = formatRp(Math.max(0, subtotal - discount) + shipping);
        }

        function showStoreToast(msg) {
            const toast = document.getElementById('storefrontToast');
            document.getElementById('storeToastMsg').innerText = msg;
            toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
        }

        async function submitStoreOrder(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...';
            btn.disabled = true;

            try {
                const custName = document.getElementById('chkCustName').value;
                const user = await getCurrentUser();
                if (!user || user.peran !== 'pelanggan') throw new Error('Sesi pelanggan berakhir. Silakan masuk kembali.');
                const deliveryMethod = document.getElementById('chkDeliveryMethod').value;
                const shippingCost = deliveryMethod === 'Ambil Sendiri' ? 0 : Number(PUBLIC_STORE_SETTINGS.biaya_kurir||0);
                const subtotal = storeCart.reduce((a, b) => a + b.price, 0);
                const discount = getActivePromoDiscount(subtotal);
                const totalAmt = Math.max(0, subtotal - discount) + shippingCost;
                const items = storeCart.map(i => i.name).join(', ');
                const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked').value;
                const saved = await ordersRequest({action:'create', kode_promo:activePromoCode, telepon:document.getElementById('chkCustPhone').value, nama_penerima:document.getElementById('chkRecipient').value, alamat:document.getElementById('chkAddress').value, tanggal_pengiriman:document.getElementById('checkoutDate').value, metode_pengiriman:deliveryMethod, metode_pembayaran:selectedPayment, pesan_kartu:document.getElementById('chkGreetingCard').value, items:storeCart.map(i=>({id:i.id,nama:i.name,harga:i.price,jumlah:1,custom:i.custom||null}))});
                const orderCode = saved.nomor_pesanan;
                const newOrder = {
                    id: orderCode,
                    webOrderId:saved.id_pesanan,
                    customerName: custName,
                    customerPhone: document.getElementById('chkCustPhone').value,
                    recipient: document.getElementById('chkRecipient').value,
                    address: document.getElementById('chkAddress').value,
                    itemsSummary: items,
                    deliveryDate: document.getElementById('checkoutDate').value,
                    deliveryMethod,
                    shippingCost,
                    paymentStatus: 'Menunggu Pembayaran',
                    paymentMethod: selectedPayment,
                    status: 'Pending',
                    florist: 'Belum Ditugaskan',
                    total: saved.total || totalAmt,
                    hpp: totalAmt * 0.45,
                    card: document.getElementById('chkGreetingCard').value || '-'
                };
                
                state.orders.unshift(newOrder);
                saveState();

                closeStoreModals();
                storeCart = [];
                activePromoCode = '';
                document.getElementById('promoCodeInput').value = '';
                document.getElementById('promoMessage').innerText = '';
                updateStoreCartUI();
                activeWebOrderId=saved.id_pesanan;
                document.getElementById('successOrderNumber').innerText=orderCode;
                document.getElementById('successOrderTotal').innerText=formatRp(saved.total||totalAmt);
                document.getElementById('successOrderMethod').innerText=selectedPayment==='QRIS / E-Wallet'?'QRIS':selectedPayment;
                const isQrisPayment = selectedPayment === 'QRIS / E-Wallet';
                                document.getElementById('successPaymentNote').innerText=isQrisPayment
                    ? 'Silakan bayar dengan QRIS. Admin akan memeriksa pembayaran sebelum pesanan diproses.'
                    : 'Bayar tunai kepada kurir saat pesanan diterima. Admin akan memperbarui status pembayaran.';
                document.getElementById('qrisPaymentAmount').innerText=formatRp(saved.total||totalAmt);
                document.getElementById('qrisPaymentPanel').classList.toggle('hidden', !isQrisPayment);
                document.getElementById('qrisDoneButton').classList.remove('hidden');
                document.getElementById('orderSuccessModal').classList.remove('hidden');
                btn.innerHTML = originalText;
                btn.disabled = false;
                e.target.reset();
            } catch(err) { alert(err.message); btn.innerHTML=originalText; btn.disabled=false; }
        }

        window.addEventListener('scroll', () => {
            const nav = document.getElementById('navbar');
            if(!nav) return;
            if (window.scrollY > 20) { nav.classList.add('shadow-md', 'bg-white/95'); nav.classList.remove('border-blush-100'); } 
            else { nav.classList.remove('shadow-md'); nav.classList.add('border-blush-100'); }
        });


        /* =======================================================
           ADMIN ERP LOGIC (Encapsulated)
           ======================================================= */
        const DEFAULT_INVENTORY = [
            { id: 'RAW-101', name: 'Mawar Merah Holland (Fresh)', category: 'Bunga Segar', qty: 120, cost: 7000, price: 15000, expiry: '2026-09-25' },
            { id: 'RAW-102', name: 'Mawar Putih Avalon', category: 'Bunga Segar', qty: 15, cost: 7500, price: 16000, expiry: '2026-09-24' },
            { id: 'WRAP-201', name: 'Kertas Cellophane Matte Pink', category: 'Wrapping Paper', qty: 50, cost: 3500, price: 8000, expiry: '-' }
        ];

        const DEFAULT_PRESETS = [
            { id: 'PRE-01', name: 'Romantic Velvet Rose Bouquet', price: 285000, hpp: 110000, desc: '10 Mawar Merah + Wrap Black Elegant' },
            { id: 'PRE-02', name: 'Pastel Dream Graduation Bouquet', price: 350000, hpp: 140000, desc: '8 Mawar Putih + Baby Breath' }
        ];

        const DEFAULT_SUPPLIERS = [
            { id: 'SUP-01', name: 'Kebun Bunga Segar Lembang', city: 'Bandung', leadTime: '1 Hari', items: 'Mawar, Lily, Krisan', rating: '4.9' }
        ];

        const DEFAULT_CUSTOMERS = [
            { id: 'CUST-001', name: 'Clarissa Valerie', phone: '081288990011', event: 'Ulang Tahun', eventDate: '2026-09-24', points: 120, totalSpend: 850000 }
        ];

        const DEFAULT_ORDERS = [];

        const DEFAULT_FINANCE = [];

        let state = {
            inventory: JSON.parse(localStorage.getItem('roos_inventory')) || DEFAULT_INVENTORY,
            orders: JSON.parse(localStorage.getItem('roos_orders')) || DEFAULT_ORDERS,
            suppliers: JSON.parse(localStorage.getItem('roos_suppliers')) || DEFAULT_SUPPLIERS,
            customers: JSON.parse(localStorage.getItem('roos_customers')) || DEFAULT_CUSTOMERS,
            finance: JSON.parse(localStorage.getItem('roos_finance')) || DEFAULT_FINANCE,
            purchases: JSON.parse(localStorage.getItem('roos_purchases')) || [],
            bom: JSON.parse(localStorage.getItem('roos_bom')) || [],
            cart: []
        };

        let erpStateLoaded = false;
        let erpStateSaveTimer = null;
        let erpStateSaveChain = Promise.resolve();
        function currentErpSnapshot() {
            return { inventory:state.inventory, suppliers:state.suppliers, customers:state.customers, finance:state.finance, purchases:state.purchases, bom:state.bom };
        }
        async function saveErpSnapshot(snapshot=currentErpSnapshot()) {
            erpStateSaveChain = erpStateSaveChain.then(async () => {
                const response=await fetch('/roos-fleur/api/erp_state.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot})});
                const result=await response.json();
                if(!response.ok||!result.status)throw new Error(result.message||'Perubahan ERP belum tersimpan ke database.');
            }).catch(error=>{showAdminToast(error.message||'Koneksi database ERP terputus.');});
            return erpStateSaveChain;
        }
        async function loadErpState(force=false) {
            if(erpStateLoaded&&!force)return;
            try {
                const response=await fetch('/roos-fleur/api/erp_state.php',{credentials:'same-origin'});
                const result=await response.json();
                if(!response.ok||!result.status)throw new Error(result.message||'Data ERP gagal dimuat.');
                const saved=result.data.state||{};
                if(Array.isArray(saved.inventory))state.inventory=saved.inventory;
                if(Array.isArray(saved.suppliers))state.suppliers=saved.suppliers;
                if(Array.isArray(saved.customers))state.customers=saved.customers;
                if(Array.isArray(saved.finance))state.finance=saved.finance;
                if(Array.isArray(saved.purchases))state.purchases=saved.purchases;
                if(Array.isArray(saved.bom))state.bom=saved.bom;
                state.orders=[];
                erpStateLoaded=true;
                localStorage.setItem('roos_inventory',JSON.stringify(state.inventory));
                localStorage.setItem('roos_suppliers',JSON.stringify(state.suppliers));
                localStorage.setItem('roos_customers',JSON.stringify(state.customers));
                localStorage.setItem('roos_finance',JSON.stringify(state.finance));
                localStorage.setItem('roos_purchases',JSON.stringify(state.purchases));
                localStorage.setItem('roos_bom',JSON.stringify(state.bom));
                localStorage.setItem('roos_orders','[]');
                if(!Object.keys(saved).length)await saveErpSnapshot();
            } catch(error) {
                // Keep the browser cache available when the database is temporarily unavailable.
                erpStateLoaded=true;
                showAdminToast(`Data ERP sementara dimuat dari perangkat ini: ${error.message}`);
            }
        }
        function saveState() {
            localStorage.setItem('roos_catalog_products', JSON.stringify(catalogProducts));
            localStorage.setItem('roos_inventory', JSON.stringify(state.inventory));
            localStorage.setItem('roos_orders', '[]');
            localStorage.setItem('roos_suppliers', JSON.stringify(state.suppliers));
            localStorage.setItem('roos_customers', JSON.stringify(state.customers));
            localStorage.setItem('roos_finance', JSON.stringify(state.finance));
            localStorage.setItem('roos_purchases', JSON.stringify(state.purchases));
            localStorage.setItem('roos_bom', JSON.stringify(state.bom));
            if(erpStateLoaded){clearTimeout(erpStateSaveTimer);const snapshot=JSON.parse(JSON.stringify(currentErpSnapshot()));erpStateSaveTimer=setTimeout(()=>saveErpSnapshot(snapshot),250);}
            if(window.location.hash === '#admin') refreshAllUI();
        }

        function resetDataDemo() {
            if(confirm("Reset seluruh data Roos & Fleur ke mode demo awal?")) {
                localStorage.clear();
                catalogProducts = [...DEFAULT_CATALOG];
                state.inventory = [...DEFAULT_INVENTORY]; state.orders = [...DEFAULT_ORDERS];
                state.suppliers = [...DEFAULT_SUPPLIERS]; state.customers = [...DEFAULT_CUSTOMERS];
                state.finance = [...DEFAULT_FINANCE]; state.purchases=[]; state.bom=[]; state.cart = [];
                saveState(); showAdminToast("Data demo Roos & Fleur berhasil dimuat ulang!");
            }
        }

        async function resetAllOrders() {
            if (!confirm('Hapus semua pesanan online dan POS secara permanen? Tindakan ini tidak dapat dibatalkan.')) return;
            try {
                const result = await ordersRequest({action:'admin_reset_orders', confirmation:'HAPUS SEMUA PESANAN'});
                webOrdersCache = [];
                state.orders = [];
                localStorage.setItem('roos_orders', JSON.stringify([]));
                await refreshAllUI();
                showAdminToast(`${result.deleted || 0} pesanan berhasil dihapus.`);
                alert(`${result.deleted || 0} pesanan berhasil dihapus.`);
            } catch (error) {
                showAdminToast(error.message || 'Pesanan gagal dihapus.');
                alert(`Pesanan gagal dihapus: ${error.message || 'Terjadi kesalahan pada server.'}`);
            }
        }

        function switchTab(tabId) {
            const tabs = ['dashboard', 'catalogadmin', 'promotions', 'pos', 'production', 'inventory', 'purchasing', 'crm', 'finance', 'services'];
            tabs.forEach(t => { const v = document.getElementById(t+'View'); if (v) v.classList.add('hidden'); });
            const targetView = document.getElementById(tabId + 'View');
            if(targetView) targetView.classList.remove('hidden');
            
            document.querySelectorAll('#adminApp .nav-btn').forEach(btn => {
                if (btn.dataset.tab === tabId) { btn.classList.add('bg-slate-800', 'text-white'); btn.classList.remove('text-slate-300'); } 
                else { btn.classList.remove('bg-slate-800', 'text-white'); btn.classList.add('text-slate-300'); }
            });

            const titles = { 
                dashboard: 'Dashboard Overview', 
                catalogadmin: 'Kelola Varian Buket & Katalog Online',
                promotions: 'Kelola Promo Toko Online',
                pos: 'Point of Sales & Penjualan Buket', 
                production: 'Produksi & Papan Perakitan Florist', 
                inventory: 'Inventaris Stok Bunga', 
                purchasing: 'Pembelian & Supplier', 
                crm: 'Manajemen Pelanggan', 
                finance: 'Laporan Keuangan' 
                ,services: 'Layanan, Konten & Pengaturan Website'
            };
            document.getElementById('pageTitle').innerText = titles[tabId] || 'Roos & Fleur ERP';
            if(tabId === 'catalogadmin') renderAdminCatalogTable();
            if(tabId === 'promotions') renderPromotionAdmin();
            if(tabId === 'services') loadAdminServices();
        }

        async function renderPromotionAdmin() {
            const tbody = document.getElementById('promotionAdminTable');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400">Memuat promo…</td></tr>';
            try {
                const data = await promotionRequest();
                const promotions = Array.isArray(data.promosi) ? data.promosi : [];
                if (!promotions.length) { tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400">Belum ada promo. Tambahkan promo untuk ditampilkan di toko.</td></tr>'; return; }
                tbody.innerHTML = promotions.map(promo => {
                    const active = Number(promo.aktif) === 1;
                    const rule = `Diskon ${Number(promo.diskon_persen)}% · Min. ${formatRp(Number(promo.minimal_belanja))}${Number(promo.maksimal_diskon) > 0 ? ` · Maks. ${formatRp(Number(promo.maksimal_diskon))}` : ''}`;
                    return `<tr><td class="p-4"><div class="flex items-center gap-3"><img src="${escapeHTML(promo.gambar_url)}" alt="" class="h-12 w-12 rounded-lg object-cover"><div><p class="font-bold text-slate-800">${escapeHTML(promo.judul)}</p><p class="text-xs text-slate-500">Kode: <b>${escapeHTML(promo.kode_promo)}</b></p></div></div></td><td class="p-4 text-xs">${escapeHTML(rule)}</td><td class="p-4"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${active ? 'Aktif' : 'Nonaktif'}</span></td><td class="p-4 text-right"><button onclick="editPromotion(${Number(promo.id_promosi)})" class="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">${active ? 'Ubah' : 'Ubah / Aktifkan'}</button> <button onclick="deletePromotion(${Number(promo.id_promosi)})" class="ml-1 rounded-lg border border-rose-100 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50" aria-label="Hapus promo">Hapus</button></td></tr>`;
                }).join('');
            } catch (error) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-rose-600">${escapeHTML(error.message)}</td></tr>`;
            }
        }

        function openPromotionForm(promo = null) {
            const form = document.getElementById('promotionForm');
            form.reset();
            document.getElementById('promotionId').value = promo ? promo.id_promosi : '';
            document.getElementById('promotionModalTitle').textContent = promo ? 'Ubah Promo' : 'Tambah Promo';
            document.getElementById('promotionTitle').value = promo?.judul || '';
            document.getElementById('promotionDescription').value = promo?.deskripsi || '';
            document.getElementById('promotionCode').value = promo?.kode_promo || '';
            document.getElementById('promotionPercent').value = promo?.diskon_persen ?? 10;
            document.getElementById('promotionMinimum').value = promo?.minimal_belanja ?? 100000;
            document.getElementById('promotionMaximum').value = promo?.maksimal_diskon ?? 50000;
            document.getElementById('promotionButtonText').value = promo?.teks_tombol || 'Pilih Buket Sekarang';
            document.getElementById('promotionImageCurrent').value = promo?.gambar_url || '';
            const preview = document.getElementById('promotionImagePreview');
            if (promo?.gambar_url) { preview.src = promo.gambar_url; preview.classList.remove('hidden'); }
            else { preview.removeAttribute('src'); preview.classList.add('hidden'); }
            document.getElementById('promotionActive').checked = promo ? Number(promo.aktif) === 1 : true;
            document.getElementById('promotionModal').classList.remove('hidden');
            document.getElementById('promotionModal').classList.add('flex');
        }
        function closePromotionForm() {
            document.getElementById('promotionModal').classList.add('hidden');
            document.getElementById('promotionModal').classList.remove('flex');
        }
        function previewPromotionImage(event) {
            const file = event.target.files?.[0];
            const preview = document.getElementById('promotionImagePreview');
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                event.target.value = '';
                showPromotionMessage('Ukuran foto banner maksimal 5 MB.', false);
                return;
            }
            if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
            preview.dataset.objectUrl = URL.createObjectURL(file);
            preview.src = preview.dataset.objectUrl;
            preview.classList.remove('hidden');
        }
        async function editPromotion(id) {
            try {
                const data = await promotionRequest();
                const promo = (data.promosi || []).find(item => Number(item.id_promosi) === Number(id));
                if (!promo) throw new Error('Promo tidak ditemukan.');
                openPromotionForm(promo);
            } catch (error) { showPromotionMessage(error.message, false); }
        }
        async function savePromotion(event) {
            event.preventDefault();
            const submit = document.getElementById('promotionSubmit');
            submit.disabled = true;
            try {
                const file = document.getElementById('promotionImageFile').files[0];
                const currentImage = document.getElementById('promotionImageCurrent').value;
                if (!file && !currentImage) throw new Error('Pilih foto banner dari perangkat Anda.');
                if (file && file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto banner maksimal 5 MB.');
                const payload = new FormData();
                payload.append('id_promosi', String(Number(document.getElementById('promotionId').value) || 0));
                payload.append('judul', document.getElementById('promotionTitle').value.trim());
                payload.append('deskripsi', document.getElementById('promotionDescription').value.trim());
                payload.append('kode_promo', document.getElementById('promotionCode').value.trim().toUpperCase());
                payload.append('diskon_persen', document.getElementById('promotionPercent').value);
                payload.append('minimal_belanja', document.getElementById('promotionMinimum').value);
                payload.append('maksimal_diskon', document.getElementById('promotionMaximum').value);
                payload.append('teks_tombol', document.getElementById('promotionButtonText').value.trim() || 'Pilih Buket Sekarang');
                payload.append('gambar_url', currentImage);
                payload.append('aktif', document.getElementById('promotionActive').checked ? '1' : '0');
                if (file) payload.append('foto_banner', file);
                await promotionRequest(payload, 'POST');
                closePromotionForm();
                await renderPromotionAdmin();
                await loadStorePromotions();
                showPromotionMessage('Promo berhasil disimpan dan aturan checkout diperbarui.', true);
            } catch (error) { showPromotionMessage(error.message, false); }
            finally { submit.disabled = false; }
        }
        async function deletePromotion(id) {
            if (!confirm('Hapus promo ini? Kode tersebut tidak akan dapat dipakai lagi.')) return;
            try {
                await promotionRequest({id_promosi:Number(id)}, 'DELETE');
                await renderPromotionAdmin();
                await loadStorePromotions();
                showPromotionMessage('Promo berhasil dihapus.', true);
            } catch (error) { showPromotionMessage(error.message, false); }
        }
        function showPromotionMessage(message, success) {
            const box = document.getElementById('promotionAdminMessage');
            if (!box) return;
            box.textContent = message;
            box.className = `rounded-xl px-4 py-3 text-sm ${success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`;
            window.setTimeout(() => box.classList.add('hidden'), 4000);
        }

        async function refreshAllUI() {
            await loadErpState();
            await loadWebOrders();
            await loadCrmAccounts();
            // Load the server catalog before calculating its dashboard KPI.
            // renderAdminCatalogTable is async because it reads the product API.
            await renderAdminCatalogTable();
            renderDashboardKPI(); renderRecentOrdersTable(); renderPOSOptionsAdmin(); renderOrdersTable(false);
            renderInventoryTable(); renderBOMTable(); renderKanbanPipeline(); renderSuppliers(); renderCRMTable();
            renderFinanceTable(); updateAdminCartUI();
        }

        function showAdminToast(msg) {
            const t = document.getElementById('adminToast');
            if(!t) return;
            document.getElementById('adminToastMsg').innerText = msg;
            t.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
        }

        function closeAdminModal(id) { document.getElementById(id).classList.add('hidden'); }

        let revenueChartInstance = null;
        function renderDashboardKPI() {
            const orders = getAllOrders();
            const paidOrders = orders.filter(o=>o.paymentStatus==='Lunas');
            const totalRev = paidOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
            document.getElementById('kpiRevenue').innerText = formatRp(totalRev);
            const todayKey=new Date().toISOString().slice(0,10);
            document.getElementById('kpiTodayOrders').innerText = orders.filter(o=>String(o.createdAt||'').slice(0,10)===todayKey).length;
            const pending = orders.filter(o => o.status === 'Pending' || o.status === 'Dirangkai').length;
            document.getElementById('kpiPendingProd').innerText = `${pending} Butuh Dirangkai`;
            document.getElementById('kpiCatalogCount').innerText = `${catalogProducts.length} Produk`;
            document.getElementById('kpiActiveStock').innerText = `${state.inventory.length} Items`;
            const lowStock = state.inventory.filter(i => i.qty <= 20).length;
            document.getElementById('kpiLowStockAlert').innerText = `⚠️ ${lowStock} Menipis`;
            
            const eventList = document.getElementById('dashboardEventList'); 
            if(eventList) {
                eventList.innerHTML = '';
                state.customers.slice(0, 3).forEach(c => {
                    eventList.innerHTML += `
                        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <div><p class="font-bold text-slate-700">${c.name}</p><span class="text-[10px] text-slate-500">${c.event} - ${c.eventDate}</span></div>
                            <a href="https://wa.me/${c.phone}" target="_blank" class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-bold text-[10px]">WA Remind</a>
                        </div>`;
                });
            }
            if(revenueChartInstance){const series=buildWeeklyRevenue();revenueChartInstance.data.labels=series.labels;revenueChartInstance.data.datasets[0].data=series.values;revenueChartInstance.update();}
        }

        function buildWeeklyRevenue(){const labels=[],values=[];const paid=getAllOrders().filter(o=>o.paymentStatus==='Lunas');for(let offset=6;offset>=0;offset--){const day=new Date();day.setDate(day.getDate()-offset);const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;labels.push(day.toLocaleDateString('id-ID',{weekday:'short'}));values.push(Math.round(paid.filter(o=>String(o.createdAt||'').slice(0,10)===key).reduce((sum,o)=>sum+Number(o.total||0),0)/1000));}return {labels,values};}

        function renderRecentOrdersTable() {
            const tbody = document.getElementById('recentOrdersTable'); 
            if(!tbody) return; 
            tbody.innerHTML = '';
            getAllOrders().slice(0, 5).forEach(o => {
                const colors = { 'Pending':'bg-amber-100 text-amber-700', 'Dirangkai':'bg-blue-100 text-blue-700', 'Siap':'bg-emerald-100 text-emerald-700', 'Dikirim':'bg-purple-100 text-purple-700', 'Selesai':'bg-slate-100 text-slate-700' };
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50">
                        <td class="p-4 font-bold text-rose-600">${o.id}</td><td class="p-4 font-semibold text-slate-800">${o.customerName}</td>
                        <td class="p-4 text-xs">${o.itemsSummary}</td><td class="p-4">${o.deliveryDate}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-100">${o.paymentStatus}</span></td>
                        <td class="p-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${colors[o.status]}">${o.status}</span></td>
                        <td class="p-4 text-right font-bold">${formatRp(o.total)}</td>
                    </tr>`;
            });
        }

        function initCharts() {
            const canvasEl = document.getElementById('revenueChart');
            if(!canvasEl) return;
            const ctx = canvasEl.getContext('2d');
            revenueChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: buildWeeklyRevenue().labels,
                    datasets: [{ label: 'Pendapatan (ribu rupiah)', data: buildWeeklyRevenue().values, borderColor: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', fill: true, tension: 0.3 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => 'Rp ' + v + 'k' } } } }
            });
        }

        /* --- ADMIN CATALOG & BUKET ADDITION (Real-Time Synchronized) --- */
        function openAddBouquetModal() {
            document.querySelector('#modalAddBouquet form').reset();
            document.getElementById('bImgInput').value = '';
            document.getElementById('bImgFile').value = '';
            document.getElementById('bProductId').value='';document.getElementById('bProductCode').value='RF-'+Date.now().toString().slice(-9);document.getElementById('bouquetSubmitButton').textContent='Simpan & Tampilkan di Web';
            document.getElementById('modalAddBouquet').classList.remove('hidden');
        }

        function editCatalogBouquet(id){const p=catalogProducts.find(x=>String(x.id_produk||x.id)===String(id));if(!p)return;document.getElementById('bProductId').value=p.id_produk||id;document.getElementById('bProductCode').value=p.kode_produk||('RF-'+String(id));document.getElementById('bNameInput').value=p.nama_produk||p.name||'';document.getElementById('bCategoryInput').value=p.kategori||p.category||'';document.getElementById('bPriceInput').value=p.harga||p.price||0;document.getElementById('bStockInput').value=p.stok??10;document.getElementById('bDescInput').value=p.deskripsi||p.desc||'';document.getElementById('bTagInput').value=p.tag||'';document.getElementById('bImgInput').value='';document.getElementById('bImgFile').value='';document.getElementById('bouquetSubmitButton').textContent='Simpan Perubahan';document.getElementById('modalAddBouquet').classList.remove('hidden');}

        function useDummyPhoto() {
            // Menggunakan gambar bunga dumy 1.jpeg atau referensi visual yang sesuai
            document.getElementById('bImgInput').value = 'https://placehold.co/600x600/fbcfe8/be123c?text=Bunga+Dumy+1+Roos+%26+Fleur';
            showAdminToast("Foto referensi 'Bunga Dumy 1' diterapkan!");
        }

        async function saveNewCatalogBouquet(e) {
            e.preventDefault();
            const name = document.getElementById('bNameInput').value;
            const category = document.getElementById('bCategoryInput').value;
            const price = parseFloat(document.getElementById('bPriceInput').value);
            const img = document.getElementById('bImgInput').value;
            const desc = document.getElementById('bDescInput').value;
            const tag = document.getElementById('bTagInput').value;
            const file = document.getElementById('bImgFile').files[0];
            const productId=document.getElementById('bProductId').value;
            if (!productId && !file && !img) { showAdminToast('Unggah foto produk atau masukkan URL foto.'); return; }
            if (file && file.size > 5 * 1024 * 1024) { showAdminToast('Ukuran foto maksimal 5 MB.'); return; }
            const payload = new FormData();
            payload.append('kode_produk', document.getElementById('bProductCode').value || ('RF-' + Date.now().toString().slice(-9)));
            payload.append('nama_produk', name); payload.append('kategori', category); payload.append('deskripsi', desc);
            payload.append('harga', String(price)); payload.append('hpp', String(Math.round(price * 0.45))); payload.append('stok', document.getElementById('bStockInput').value); payload.append('satuan', 'pcs'); payload.append('status', 'Aktif');
            if(productId){payload.append('action','update');payload.append('id_produk',productId);}
            if (file) payload.append('foto', file); else if (img) payload.append('foto_url', img);
            try {
                const response = await fetch('/roos-fleur/api/produk.php', {method:'POST', body:payload, credentials:'same-origin'});
                const result = await response.json();
                if (!response.ok || !result.status) throw new Error(result.message || 'Produk gagal disimpan.');
                const p = result.data?.produk || result.data;
                if(productId){catalogProducts=catalogProducts.map(item=>String(item.id_produk||item.id)===String(productId)?{...item,nama_produk:name,name,kategori:category,category,harga:price,price,stok:Number(document.getElementById('bStockInput').value),deskripsi:desc,desc,foto_url:p.foto_url||item.foto_url,img:p.foto_url||item.img}:item);}else catalogProducts.unshift({id_produk:p.id_produk, nama_produk:name, kategori:category, harga:price, deskripsi:desc, foto_url:p.foto_url || p.foto || img, tag});
                localStorage.setItem('roos_catalog_products', JSON.stringify(catalogProducts));
                closeAdminModal('modalAddBouquet'); renderAdminCatalogTable(); renderCatalog('Semua'); showAdminToast(productId?`Produk "${name}" berhasil diperbarui.`:`Produk "${name}" berhasil diunggah.`); e.target.reset();document.getElementById('bProductId').value='';
            } catch(err) { showAdminToast(err.message); }
        }

        async function renderAdminCatalogTable() {
            const tbody = document.getElementById('adminCatalogTableBody');
            const search = (document.getElementById('adminCatalogSearch') || {value:''}).value.toLowerCase();
            if(!tbody) return;
            tbody.innerHTML = '';
            try {
                const response=await fetch('/roos-fleur/api/produk.php',{credentials:'same-origin'}); const result=await response.json();
                if(result.status && Array.isArray(result.data?.produk)) catalogProducts=result.data.produk.map(p=>({id_produk:p.id_produk,id:p.id_produk,kode_produk:p.kode_produk,stok:Number(p.stok||0),nama_produk:p.nama_produk,name:p.nama_produk,kategori:p.kategori,category:p.kategori,harga:Number(p.harga),price:Number(p.harga),deskripsi:p.deskripsi,desc:p.deskripsi,foto_url:p.foto_url,img:p.foto_url,tag:p.tag||''}));
            } catch(_) {}
            const filtered = catalogProducts.filter(p => String(p.nama_produk||p.name||'').toLowerCase().includes(search) || String(p.kategori||p.category||'').toLowerCase().includes(search));
            document.getElementById('adminCatalogCount').innerText = `Total ${catalogProducts.length} Varian`;

            filtered.forEach(p => {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-3">
                            <img src="${p.img}" class="w-12 h-12 rounded-xl object-cover border border-slate-200" onerror="this.src='https://placehold.co/100x100/fbcfe8/db2777?text=Foto'">
                        </td>
                        <td class="p-3 font-bold text-slate-800">${p.nama_produk||p.name}</td>
                        <td class="p-3"><span class="px-2.5 py-1 bg-blush-50 text-blush-600 rounded-lg text-[11px] font-semibold">${p.kategori||p.category}</span></td>
                        <td class="p-3 font-bold text-rose-600">${formatRp(p.harga||p.price)}</td>
                        <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">${p.tag || '-'}</span></td>
                        <td class="p-3 text-right">
                            <button onclick="editCatalogBouquet('${p.id_produk||p.id}');document.getElementById('modalAddBouquet').classList.remove('hidden')" class="mr-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg" title="Ubah Varian"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="deleteCatalogBouquet('${p.id_produk||p.id}')" class="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors" title="Hapus Varian">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        async function deleteCatalogBouquet(id) {
            if(confirm("Hapus varian buket ini dari katalog online Roos & Fleur?")) {
                try {
                    const response=await fetch('/roos-fleur/api/produk.php?id_produk='+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin'}); const result=await response.json();
                    if(!response.ok || !result.status) throw new Error(result.message||'Produk gagal dihapus.');
                    catalogProducts=catalogProducts.filter(p=>String(p.id_produk||p.id)!==String(id));
                    renderAdminCatalogTable(); renderCatalog('Semua'); showAdminToast('Produk berhasil dihapus.');
                } catch(err) { showAdminToast(err.message); }
            }
        }

        function setPOSMode(mode) {
            if(mode === 'custom') {
                document.getElementById('customBouquetBuilderAdmin').classList.remove('hidden'); document.getElementById('presetBouquetCatalogAdmin').classList.add('hidden');
                document.getElementById('tabModeCustom').className = "flex-1 py-2 rounded-xl text-xs font-bold border border-rose-500 bg-rose-50 text-rose-600";
                document.getElementById('tabModePreset').className = "flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600";
            } else {
                document.getElementById('customBouquetBuilderAdmin').classList.add('hidden'); document.getElementById('presetBouquetCatalogAdmin').classList.remove('hidden');
                document.getElementById('tabModePreset').className = "flex-1 py-2 rounded-xl text-xs font-bold border border-rose-500 bg-rose-50 text-rose-600";
                document.getElementById('tabModeCustom').className = "flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600";
            }
        }

        function renderPOSOptionsAdmin() {
            const fSel = document.getElementById('posFlowerSelect'), wSel = document.getElementById('posWrapSelect'), rSel = document.getElementById('posRibbonSelect');
            if(!fSel) return;
            fSel.innerHTML = ''; wSel.innerHTML = ''; rSel.innerHTML = '';
            state.inventory.filter(i=>i.category==='Bunga Segar').forEach(f => fSel.innerHTML += `<option value="${f.id}">${f.name} - ${formatRp(f.price)}</option>`);
            state.inventory.filter(i=>i.category==='Wrapping Paper').forEach(w => wSel.innerHTML += `<option value="${w.id}">${w.name} - ${formatRp(w.price)}</option>`);
            state.inventory.filter(i=>i.category==='Pita & Aksesoris').forEach(r => rSel.innerHTML += `<option value="${r.id}">${r.name} - ${formatRp(r.price)}</option>`);

            const pCat = document.getElementById('presetBouquetCatalogAdmin'); 
            if(pCat) {
                pCat.innerHTML = '';
                catalogProducts.slice(0, 4).forEach(p => {
                    pCat.innerHTML += `
                        <div class="p-3 border rounded-xl bg-slate-50 flex flex-col justify-between">
                            <div><h4 class="font-bold text-xs">${p.name}</h4><p class="text-[10px] text-slate-500">${p.category}</p></div>
                            <div class="flex items-center justify-between mt-2"><span class="font-bold text-rose-600 text-xs">${formatRp(p.price)}</span>
                            <button onclick="addCatalogItemToAdminCart('${p.id}')" class="px-2 bg-rose-600 text-white rounded text-[10px]">+ Tambah</button></div>
                        </div>`;
                });
            }
            const cSel = document.getElementById('posCustomerSelect'); 
            if(cSel) {
                cSel.innerHTML = '';
                state.customers.forEach(c => cSel.innerHTML += `<option value="${c.name}">${c.name}</option>`);
            }
            calculateCustomHPPAdmin();
        }

        function addCatalogItemToAdminCart(id) {
            const p = catalogProducts.find(x => x.id === id);
            if(p) {
                state.cart.push({ id: p.id+'-'+Date.now(), productId: p.id_produk || p.id, name: p.name, details: p.category, price: p.price, hpp: p.price * 0.45, card: '-' });
                updateAdminCartUI();
                showAdminToast(`${p.name} ditambahkan ke kasir!`);
            }
        }

        function calculateCustomHPPAdmin() {
            const qtyEl = document.getElementById('posFlowerQty');
            if(!qtyEl) return 0;
            const fQty = parseInt(qtyEl.value)||1;
            const f = state.inventory.find(i=>i.id===document.getElementById('posFlowerSelect').value);
            const w = state.inventory.find(i=>i.id===document.getElementById('posWrapSelect').value);
            const r = state.inventory.find(i=>i.id===document.getElementById('posRibbonSelect').value);
            let hpp = (f?f.cost*fQty:0) + (w?w.cost:0) + (r?r.cost:0);
            const hppEl = document.getElementById('posCustomHPP');
            if(hppEl) hppEl.innerText = formatRp(hpp); 
            return hpp;
        }

        ['posFlowerSelect','posFlowerQty','posWrapSelect','posRibbonSelect'].forEach(id => {
            const el = document.getElementById(id); if(el) el.addEventListener('change', calculateCustomHPPAdmin);
        });

        function addCustomToAdminCart() {
            const fQty = parseInt(document.getElementById('posFlowerQty').value)||1;
            const f = state.inventory.find(i=>i.id===document.getElementById('posFlowerSelect').value);
            const w = state.inventory.find(i=>i.id===document.getElementById('posWrapSelect').value);
            if(!f || !w) return showAdminToast("Pilih komponen terlebih dahulu!");
            const hpp = calculateCustomHPPAdmin();
            state.cart.push({ id:'C-'+Date.now(), name:`Custom (${fQty}x ${f.name})`, details:`Wrap: ${w.name}`, price: Math.round((hpp*2.2)/5000)*5000, hpp:hpp, card:document.getElementById('posGreetingCard').value });
            updateAdminCartUI(); showAdminToast("Buket kustom ditambahkan ke kasir!");
        }

        function getAdminShippingCost() {
            if (!state.cart.length) return 0;
            const method = document.getElementById('posDeliveryMethod')?.value;
            return method === 'Ambil di Toko' ? 0 : Number(PUBLIC_STORE_SETTINGS.biaya_kurir||15000);
        }

        function updateAdminCartUI() {
            const list = document.getElementById('adminCartItemsList'); if(!list) return; list.innerHTML = '';
            let subtotal = 0;
            state.cart.forEach((i, idx) => {
                subtotal += i.price;
                list.innerHTML += `
                    <div class="p-2 bg-slate-50 border rounded-xl flex justify-between text-xs items-center">
                        <div><h5 class="font-bold">${i.name}</h5><span class="font-bold text-rose-600">${formatRp(i.price)}</span></div>
                        <button onclick="state.cart.splice(${idx},1);updateAdminCartUI()" class="text-rose-500 hover:text-rose-700 px-2"><i class="fa-solid fa-trash"></i></button>
                    </div>`;
            });
            const shippingCost = getAdminShippingCost();
            document.getElementById('adminCartSubtotal').innerText = formatRp(subtotal);
            document.getElementById('posShippingCost').innerText = formatRp(shippingCost);
            document.getElementById('adminCartTotal').innerText = formatRp(subtotal + shippingCost);
        }

        function clearAdminCart() { state.cart = []; updateAdminCartUI(); }

        async function processAdminCheckout() {
            if(!state.cart.length) return showAdminToast("Keranjang kasir masih kosong!");
            const customerName = document.getElementById('posCustomerSelect').value;
            const customer = state.customers.find(item => item.name === customerName) || {};
            const deliveryMethod = document.getElementById('posDeliveryMethod').value === 'Ambil di Toko' ? 'Ambil Sendiri' : 'Kurir Toko';
            try {
                const saved = await ordersRequest({
                    action: 'admin_create',
                    nama_pemesan: customerName,
                    nama_penerima: customerName,
                    telepon: customer.phone || '-',
                    alamat: deliveryMethod === 'Ambil Sendiri' ? 'Ambil langsung di toko' : 'Alamat dikonfirmasi kasir',
                    tanggal_pengiriman: document.getElementById('posDeliveryDate').value,
                    metode_pengiriman: deliveryMethod,
                    status_pembayaran: document.getElementById('posPaymentStatus').value,
                    metode_pembayaran: document.getElementById('posPaymentMethod').value,
                    pesan_kartu: state.cart[0].card || '',
                    items: state.cart.map(item => ({id: item.productId || '', nama: item.name, harga: Number(item.price), hpp: Number(item.hpp || 0)}))
                });
                clearAdminCart();
                await erpStateSaveChain;await loadErpState(true);
                await refreshAllUI();
                showAdminToast(`Penjualan ${saved.nomor_pesanan} berhasil disimpan.`);
            } catch (error) {
                showAdminToast(error.message || 'Penjualan POS gagal disimpan.');
            }
        }

        let webOrdersCache = [];
        let crmAccountsCache = [];
        async function loadCrmAccounts(){try{const data=await authRequest({action:'admin_users'});crmAccountsCache=(data.users||[]).filter(u=>u.peran==='pelanggan');}catch(_){crmAccountsCache=[];}}
        const toUiOrderStatus = status => ({'Menunggu Pembayaran':'Pending','Menunggu Diproses':'Pending','Siap Diambil':'Siap'}[status] || status);
        const toDbOrderStatus = status => ({'Pending':'Menunggu Diproses','Siap':'Siap Diambil'}[status] || status);
        const webOrderToUiOrder = o => ({id:o.nomor_pesanan,webOrderId:Number(o.id_pesanan),serverStatus:o.status_pesanan,customerName:o.nama_pemesan,customerPhone:o.telepon,recipient:o.nama_penerima,address:o.alamat,itemsSummary:(o.items||[]).map(i=>i.nama+(i.jumlah>1?' × '+i.jumlah:'')).join(', '),deliveryDate:o.tanggal_pengiriman,createdAt:o.dibuat_pada,deliveryMethod:o.metode_pengiriman,paymentStatus:o.status_pembayaran,paymentMethod:o.metode_pembayaran,courierName:o.nama_kurir,courierPhone:o.telepon_kurir,deliveryNote:o.catatan_pengiriman,status:toUiOrderStatus(o.status_pesanan),total:Number(o.total),discount:Number(o.diskon||0),promoCode:o.kode_promo,shippingCost:Number(o.ongkir)});
        const getAllOrders = () => {
            return webOrdersCache.map(webOrderToUiOrder);
        };
        async function loadWebOrders() {
            try {
                const response = await fetch('/roos-fleur/api/orders_web.php', {credentials:'same-origin'});
                const result = await response.json();
                if (!response.ok || !result.status) throw new Error(result.message || 'Pesanan tidak dapat dimuat.');
                webOrdersCache = result.data.orders || [];
            } catch (error) {
                console.warn('Pesanan server tidak dapat dimuat:', error.message);
            }
        }
        async function renderOrdersTable(reload = true) {
            const tbody = document.getElementById('posAllOrdersTable'), search = (document.getElementById('orderSearchInput')||{value:''}).value.toLowerCase(), filter = (document.getElementById('orderStatusFilter')||{value:'ALL'}).value;
            if(!tbody) return; tbody.innerHTML = '';
            if (reload) await loadWebOrders();
            const orders = getAllOrders();
            orders.filter(o => (String(o.customerName||'').toLowerCase().includes(search) || String(o.id||'').toLowerCase().includes(search)) && (filter==='ALL' || o.status===filter)).forEach(o => {
                const isWeb=Boolean(o.webOrderId);
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50"><td class="p-3 font-bold text-rose-600">${o.id}</td><td class="p-3">${o.customerName}</td>
                    <td class="p-3" title="${escapeHTML(o.address||'')}">${escapeHTML(o.itemsSummary||'')} ${isWeb?`<div class="mt-1 text-[10px] text-slate-400">${escapeHTML(o.deliveryMethod)} · ${escapeHTML(o.deliveryDate)} · Ongkir ${formatRp(o.shippingCost||0)}${o.discount?` · Promo ${escapeHTML(o.promoCode||'')} −${formatRp(o.discount)}`:''}</div>${o.courierName?`<div class="mt-1 text-[10px] font-semibold text-slate-600">Kurir: ${escapeHTML(o.courierName)} · ${escapeHTML(o.courierPhone||'')}</div>`:''}`:''}</td>
                    <td class="p-3">${isWeb?`<select onchange="updateOrderStatus('${o.id}',this.value)" class="rounded border p-1 text-[10px]"><option ${o.status==='Pending'?'selected':''}>Pending</option><option ${o.status==='Dirangkai'?'selected':''}>Dirangkai</option><option ${o.status==='Siap'?'selected':''}>Siap</option><option ${o.status==='Dikirim'?'selected':''}>Dikirim</option><option ${o.status==='Selesai'?'selected':''}>Selesai</option></select>`:`<span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${escapeHTML(o.status)}</span>`}</td>
                    <td class="p-3"><select onchange="updatePaymentStatus('${o.id}',this.value)" class="px-2 py-1 bg-amber-50 text-amber-800 rounded text-[10px] font-bold border-0"><option ${o.paymentStatus==='Menunggu Pembayaran'?'selected':''}>Menunggu Pembayaran</option><option ${o.paymentStatus==='Belum Lunas'?'selected':''}>Belum Lunas</option><option ${o.paymentStatus==='Lunas'?'selected':''}>Lunas</option></select><div class="text-[10px] text-slate-400 mt-1">${escapeHTML(o.paymentMethod==='QRIS / E-Wallet'?'QRIS':(o.paymentMethod||''))}</div></td>
                    <td class="p-3 text-right">${isWeb?`<div class="flex flex-wrap justify-end gap-2"><button onclick="showWebOrderDetails('${escapeHTML(o.id)}')" class="text-blush-600 text-xs">Detail</button>${o.deliveryMethod!=='Ambil Sendiri'?`<button onclick="openCourierAssignment('${escapeHTML(o.id)}')" class="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-blush-50 hover:text-blush-600">${o.courierName?'Ubah Kurir':'Atur Kurir'}</button>`:''}</div>`:`<button onclick="deleteOrder('${o.id}')" class="text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>`}</td></tr>`;
            });
        }
        function deleteOrder(id) { if(confirm("Hapus pesanan ini?")) { state.orders = state.orders.filter(o=>o.id!==id); saveState(); showAdminToast("Pesanan dihapus"); } }
        async function updateWebOrder(id, paymentStatus, uiStatus) {
            const order=webOrdersCache.find(o=>o.nomor_pesanan===id); if(!order) return;
            try { await ordersRequest({action:'admin_update',id_pesanan:Number(order.id_pesanan),status_pembayaran:paymentStatus,status_pesanan:toDbOrderStatus(uiStatus)});await erpStateSaveChain;await loadErpState(true);showAdminToast(`Pesanan ${id} diperbarui.`);await refreshAllUI(); }
            catch(err){alert(err.message);await refreshAllUI();}
        }
        function showWebOrderDetails(id){const o=webOrdersCache.find(x=>x.nomor_pesanan===id);if(o)alert(`Penerima: ${o.nama_penerima}\nTelepon: ${o.telepon}\nAlamat: ${o.alamat}\nTanggal kirim: ${o.tanggal_pengiriman}\nMetode: ${o.metode_pengiriman}\nKurir: ${o.nama_kurir||'Belum ditugaskan'}${o.telepon_kurir?' · '+o.telepon_kurir:''}${o.catatan_pengiriman?'\nCatatan kurir: '+o.catatan_pengiriman:''}\nTotal: ${formatRp(o.total)}`);}
        let courierAssignmentOrderId = null;
        function openCourierAssignment(orderNumber) {
            const order=webOrdersCache.find(o=>o.nomor_pesanan===orderNumber);
            if(!order) return alert('Data pesanan belum tersedia. Muat ulang daftar pesanan.');
            if(order.metode_pengiriman==='Ambil Sendiri') return showAdminToast('Pesanan ini diambil sendiri dan tidak memerlukan kurir.');
            courierAssignmentOrderId=Number(order.id_pesanan);
            document.getElementById('courierOrderNumber').innerText=`Pesanan ${order.nomor_pesanan} · ${order.nama_penerima}`;
            document.getElementById('courierNameInput').value=order.nama_kurir||'';
            document.getElementById('courierPhoneInput').value=order.telepon_kurir||'';
            document.getElementById('courierNoteInput').value=order.catatan_pengiriman||'';
            const modal=document.getElementById('modalCourierAssignment'); modal.classList.remove('hidden'); modal.classList.add('flex');
            document.getElementById('courierNameInput').focus();
        }
        async function submitCourierAssignment(name, phone, note) {
            if(!courierAssignmentOrderId) throw new Error('Pilih pesanan terlebih dahulu.');
            const saved=await ordersRequest({action:'admin_assign_courier',id_pesanan:courierAssignmentOrderId,nama_kurir:name,telepon_kurir:phone,catatan_pengiriman:note});
            closeAdminModal('modalCourierAssignment');
            showAdminToast(name?'Kurir berhasil ditugaskan.':'Penugasan kurir dihapus.');
            await refreshAllUI();
            return saved;
        }
        async function saveCourierAssignment(event) {
            event.preventDefault();
            const button=document.getElementById('saveCourierButton'); button.disabled=true; button.innerText='Menyimpan…';
            try { await submitCourierAssignment(document.getElementById('courierNameInput').value.trim(),document.getElementById('courierPhoneInput').value.trim(),document.getElementById('courierNoteInput').value.trim()); }
            catch(error) { alert(error.message); }
            finally { button.disabled=false; button.innerText='Simpan kurir'; }
        }
        async function removeCourierAssignment() {
            if(!courierAssignmentOrderId || !confirm('Hapus penugasan kurir untuk pesanan ini?')) return;
            try { await submitCourierAssignment('','',''); }
            catch(error) { alert(error.message); }
        }
        function updatePaymentStatus(id, status) {
            const web=webOrdersCache.find(o=>o.nomor_pesanan===id);
            if(web){updateWebOrder(id,status,toUiOrderStatus(web.status_pesanan));return;}
            const order=state.orders.find(o=>o.id===id); if(order){ order.paymentStatus=status; if(status==='Lunas') state.finance.unshift({date:new Date().toISOString().split('T')[0],desc:`Pembayaran pesanan ${id}`,type:'IN',category:'Penjualan Buket',amount:Number(order.total||0)}); saveState(); showAdminToast(`Pembayaran ${id}: ${status}`); }
        }

        /* KANBAN */
        function renderKanbanPipeline() {
            const cols = { 'Pending': document.getElementById('kanbanPending'), 'Dirangkai': document.getElementById('kanbanProgress'), 'Siap': document.getElementById('kanbanReady'), 'Dikirim': document.getElementById('kanbanDelivery') };
            Object.values(cols).forEach(c => { if(c) c.innerHTML = ''; });
            let counts = { 'Pending': 0, 'Dirangkai': 0, 'Siap': 0, 'Dikirim': 0 };

            getAllOrders().forEach(o => {
                const c = cols[o.status];
                if(c) {
                    counts[o.status]++;
                    c.innerHTML += `
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                            <div class="flex justify-between"><span class="font-bold text-xs text-rose-600">${o.id}</span><span class="text-[10px] text-slate-400">${o.deliveryDate}</span></div>
                            <h5 class="font-bold text-xs">${o.customerName}</h5><p class="text-[11px]">${o.itemsSummary}</p>
                            <select onchange="updateOrderStatus('${o.id}', this.value)" class="text-[10px] p-1 border rounded bg-slate-50 outline-none w-full mt-2">
                                ${Object.keys(cols).map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                                <option value="Selesai">Selesai</option>
                            </select>
                        </div>`;
                }
            });
            Object.keys(counts).forEach(k => {
                const el = document.getElementById('count' + (k==='Dirangkai'?'Progress':k));
                if(el) el.innerText = counts[k];
            });
        }
        function updateOrderStatus(id, status) {
            if(webOrdersCache.some(o=>o.nomor_pesanan===id)) { const order=webOrdersCache.find(o=>o.nomor_pesanan===id); updateWebOrder(id,order.status_pembayaran,status); return; }
            const o = state.orders.find(x=>x.id===id); if(o) { o.status = status; saveState(); showAdminToast(`Status diubah ke ${status}`); }
        }

        /* INVENTORY */
        let stockCatFilter = 'ALL';
        function filterStockCategory(cat) {
            stockCatFilter = cat;
            document.querySelectorAll('.stock-cat-btn').forEach(b => {
                if(b.innerText.includes(cat) || (cat==='ALL' && b.innerText.includes('Semua'))) b.className = "stock-cat-btn active px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl";
                else b.className = "stock-cat-btn px-4 py-2 bg-white text-slate-600 border border-slate-200 text-xs font-semibold rounded-xl";
            });
            renderInventoryTable();
        }
        function renderInventoryTable() {
            const tbody = document.getElementById('inventoryTableBody'), search = (document.getElementById('stockSearchInput')||{value:''}).value.toLowerCase();
            if(!tbody) return; tbody.innerHTML = '';
            const filtered = state.inventory.filter(i => (stockCatFilter==='ALL'||i.category===stockCatFilter) && i.name.toLowerCase().includes(search));
            document.getElementById('stockSummaryCount').innerText = `Menampilkan ${filtered.length} items`;
            filtered.forEach(i => {
                tbody.innerHTML += `<tr class="hover:bg-slate-50"><td class="p-4 font-mono text-xs">${escapeHTML(i.id)}</td><td class="p-4 font-bold">${escapeHTML(i.name)}</td>
                <td class="p-4"><span class="px-2 py-1 bg-slate-100 rounded text-[10px]">${escapeHTML(i.category)}</span></td><td class="p-4 font-bold ${i.qty<=20?'text-rose-600':''}">${Number(i.qty)||0}</td>
                <td class="p-4">${formatRp(i.cost)}</td><td class="p-4 font-bold text-emerald-600">${formatRp(i.price)}</td><td class="p-4">${escapeHTML(i.expiry||'-')}</td>
                <td class="p-4 text-right"><button onclick="editStock(${safeHandlerArg(i.id)})" class="mr-2 text-blue-600" aria-label="Ubah bahan"><i class="fa-solid fa-pen"></i></button><button onclick="deleteStock(${safeHandlerArg(i.id)})" class="text-rose-500" aria-label="Hapus bahan"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            });
        }
        function openNewStockModal() { document.querySelector('#modalStock form').reset();document.getElementById('mStockId').value='';document.getElementById('modalStock').classList.remove('hidden'); }
        function editStock(id){const item=state.inventory.find(x=>String(x.id)===String(id));if(!item)return;document.getElementById('mStockId').value=item.id;document.getElementById('mStockName').value=item.name;document.getElementById('mStockCat').value=item.category;document.getElementById('mStockQty').value=item.qty;document.getElementById('mStockCost').value=item.cost;document.getElementById('mStockPrice').value=item.price;document.getElementById('mStockExpiry').value=item.expiry&&item.expiry!=='-'?item.expiry:'';document.getElementById('modalStock').classList.remove('hidden');}
        function deleteStock(id){if(!confirm('Hapus bahan baku ini?'))return;state.inventory=state.inventory.filter(x=>String(x.id)!==String(id));saveState();showAdminToast('Bahan baku dihapus.');}
        function saveNewStock(e) {
            e.preventDefault();
            const id=document.getElementById('mStockId').value;let item=state.inventory.find(x=>String(x.id)===String(id));if(!item){item={id:'RAW-'+Date.now()};state.inventory.unshift(item);}item.name=document.getElementById('mStockName').value.trim();item.category=document.getElementById('mStockCat').value;item.qty=parseInt(document.getElementById('mStockQty').value)||0;item.cost=parseFloat(document.getElementById('mStockCost').value)||0;item.price=parseFloat(document.getElementById('mStockPrice').value)||0;item.expiry=document.getElementById('mStockExpiry').value||'-';
            closeAdminModal('modalStock'); saveState(); showAdminToast("Bahan baku ditambahkan!");
        }
        function renderBOMTable(){const pSelect=document.getElementById('bomProduct'),mSelect=document.getElementById('bomMaterial'),tbody=document.getElementById('bomTableBody');if(!pSelect||!mSelect||!tbody)return;const customComponents=[['CUSTOM:F1','Buket kustom · Mawar Merah (per batang)'],['CUSTOM:F2','Buket kustom · Mawar Putih (per batang)'],['CUSTOM:F3','Buket kustom · Mawar Pink (per batang)'],['CUSTOM:WRAP:W1','Buket kustom · Kertas Soft Pink'],['CUSTOM:WRAP:W2','Buket kustom · Kertas Classic White'],['CUSTOM:WRAP:W3','Buket kustom · Kertas Elegant Black'],...['Satin Pink','Satin Putih','Tali Rami Vintage','Pita Emas Premium','Tanpa Pita'].map(name=>[`CUSTOM:RIBBON:${name}`,`Buket kustom · Pita ${name}`])];pSelect.innerHTML='<option value="">Pilih produk atau komponen buket kustom</option>'+catalogProducts.map(p=>`<option value="${escapeHTML(p.id_produk||p.id)}">${escapeHTML(p.nama_produk||p.name)}</option>`).join('')+customComponents.map(([id,name])=>`<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join('');mSelect.innerHTML='<option value="">Pilih bahan baku</option>'+state.inventory.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)} · ${Number(i.qty)||0} tersedia</option>`).join('');tbody.innerHTML=state.bom.map((row,index)=>{const product=catalogProducts.find(p=>String(p.id_produk||p.id)===String(row.productId));const custom=customComponents.find(([id])=>id===String(row.productId));const material=state.inventory.find(i=>String(i.id)===String(row.materialId));return `<tr><td class="p-2">${escapeHTML(product?.nama_produk||product?.name||custom?.[1]||row.productId)}</td><td class="p-2">${escapeHTML(material?.name||row.materialId)}</td><td class="p-2">${Number(row.qty)} ${escapeHTML(material?.unit||'unit')}</td><td class="p-2 text-right"><button onclick="deleteBOMItem(${index})" class="text-rose-600" aria-label="Hapus resep"><i class="fa-solid fa-trash"></i></button></td></tr>`;}).join('')||'<tr><td colspan="4" class="p-3 text-slate-400">Belum ada resep produk. Tambahkan bahan yang digunakan untuk merakit produk.</td></tr>';}
        function saveBOMItem(event){event.preventDefault();const productId=bomProduct.value,materialId=bomMaterial.value,qty=Number(bomQuantity.value);if(!productId||!materialId||!Number.isFinite(qty)||qty<=0)return;const existing=state.bom.find(x=>String(x.productId)===String(productId)&&String(x.materialId)===String(materialId));if(existing)existing.qty=qty;else state.bom.push({productId:String(productId),materialId:String(materialId),qty});event.target.reset();renderBOMTable();saveState();showAdminToast('Resep produk disimpan.');}
        function deleteBOMItem(index){state.bom.splice(index,1);renderBOMTable();saveState();}

        /* SUPPLIERS */
        function renderSuppliers() {
            const grid = document.getElementById('suppliersCardGrid'); if(!grid) return; grid.innerHTML = '';
            state.suppliers.forEach(s => grid.innerHTML += `<div class="bg-white p-5 rounded-2xl border"><div class="flex items-start justify-between gap-2"><div><h4 class="font-bold text-sm">${escapeHTML(s.name)}</h4><p class="text-xs text-slate-500">${escapeHTML(s.city)}</p></div><div class="flex gap-2"><button onclick="editSupplier('${escapeHTML(s.id)}')" class="text-blue-600" aria-label="Ubah supplier"><i class="fa-solid fa-pen"></i></button><button onclick="deleteSupplier('${escapeHTML(s.id)}')" class="text-rose-600" aria-label="Hapus supplier"><i class="fa-solid fa-trash"></i></button></div></div><p class="mt-2 text-xs text-slate-600">${escapeHTML(s.items||'')}</p><p class="mt-1 text-[10px] text-slate-400">Lead time: ${escapeHTML(s.leadTime||'-')} ${s.phone?`· ${escapeHTML(s.phone)}`:''}</p></div>`);
            const pBod = document.getElementById('poTableBody'); if(pBod) {pBod.innerHTML = '';state.purchases.forEach(po=>{pBod.innerHTML+=`<tr><td class="p-3 font-mono">${escapeHTML(po.id)}</td><td class="p-3">${escapeHTML(po.supplier)}</td><td class="p-3">${escapeHTML(po.items)}${po.quantity?` · ${Number(po.quantity)} ${escapeHTML(po.unit||'unit')}`:''}</td><td class="p-3 text-right">${formatRp(po.amount)}</td><td class="p-3">${escapeHTML(po.status)}</td><td class="p-3 text-right">${po.status==='Diajukan'?`<button onclick="receivePurchase('${escapeHTML(po.id)}')" class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Tandai diterima</button>`:'-'}</td></tr>`;});}
        }
        function openSupplierModal(){document.querySelector('#modalSupplier form').reset();supplierId.value='';document.getElementById('modalSupplier').classList.remove('hidden');}
        function editSupplier(id){const s=state.suppliers.find(x=>String(x.id)===String(id));if(!s)return;supplierId.value=s.id;supplierName.value=s.name;supplierCity.value=s.city;supplierItems.value=s.items;supplierPhone.value=s.phone||'';supplierLeadTime.value=s.leadTime||'';document.getElementById('modalSupplier').classList.remove('hidden');}
        function saveSupplier(event){event.preventDefault();const id=supplierId.value;let item=state.suppliers.find(x=>String(x.id)===String(id));if(!item){item={id:'SUP-'+Date.now()};state.suppliers.unshift(item);}item.name=supplierName.value.trim();item.city=supplierCity.value.trim();item.items=supplierItems.value.trim();item.phone=supplierPhone.value.trim();item.leadTime=supplierLeadTime.value.trim();closeAdminModal('modalSupplier');saveState();showAdminToast('Data supplier disimpan.');}
        function deleteSupplier(id){if(!confirm('Hapus data supplier ini? Riwayat PO yang sudah dibuat tetap ada.'))return;state.suppliers=state.suppliers.filter(s=>String(s.id)!==String(id));saveState();showAdminToast('Supplier dihapus.');}
        function openPOModal() { const supplier=document.getElementById('mPOSupplier'),material=document.getElementById('mPOItems');supplier.innerHTML=state.suppliers.map(s=>`<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');material.innerHTML='<option value="">Pilih bahan baku yang dipesan</option>'+state.inventory.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)} (${escapeHTML(i.unit||'unit')})</option>`).join('');document.querySelector('#modalPO form').reset();document.getElementById('modalPO').classList.remove('hidden'); }
        function saveNewPO(e) {
            e.preventDefault();
            const materialId=document.getElementById('mPOItems').value,material=state.inventory.find(i=>String(i.id)===String(materialId)),quantity=Number(document.getElementById('mPOQuantity').value),amt=Number(document.getElementById('mPOTotal').value);
            if(!material||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(amt)||amt<0){showAdminToast('Pilih bahan dan isi jumlah serta biaya yang valid.');return;}
            const supplierId=document.getElementById('mPOSupplier').value,supplier=state.suppliers.find(s=>String(s.id)===String(supplierId));
            state.purchases.unshift({id:'PO-'+new Date().toISOString().slice(2,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),supplier:supplier?.name||'Supplier',supplierId,materialId:String(material.id),quantity,unit:material.unit||'unit',items:material.name,amount:amt,date:new Date().toISOString().slice(0,10),status:'Diajukan',expenseRecorded:false,stockRecorded:false});
            closeAdminModal('modalPO'); saveState(); showAdminToast('Purchase Order dibuat. Biaya dan stok dicatat setelah barang diterima.');
        }
        function receivePurchase(id){const po=state.purchases.find(item=>item.id===id);if(!po||po.status!=='Diajukan')return;po.status='Diterima';const material=state.inventory.find(i=>String(i.id)===String(po.materialId));if(material&&!po.stockRecorded){material.qty=(Number(material.qty)||0)+(Number(po.quantity)||0);po.stockRecorded=true;}if(!po.expenseRecorded){state.finance.unshift({date:new Date().toISOString().slice(0,10),desc:`Pembelian ${po.id}: ${po.items}`,type:'OUT',category:'Bahan Baku',amount:Number(po.amount)||0});po.expenseRecorded=true;}saveState();showAdminToast('PO diterima: stok dan pengeluaran sudah diperbarui.');}

        /* CRM */
        function renderCRMTable() {
            const tbody = document.getElementById('crmTableBody'); if(!tbody) return; tbody.innerHTML = '';
            const orderGroups=new Map();getAllOrders().forEach(o=>{const key=String(o.customerPhone||'').replace(/\D/g,'')||String(o.customerName||'').toLowerCase();if(!orderGroups.has(key))orderGroups.set(key,{id:'ORDER:'+key,name:o.customerName,phone:o.customerPhone||'',event:'-',eventDate:'',points:0,totalSpend:0,interactions:[],orderCount:0,isAccount:false});const customer=orderGroups.get(key);customer.orderCount++;if(o.paymentStatus==='Lunas')customer.totalSpend+=Number(o.total)||0;});
            crmAccountsCache.forEach(a=>{const key=String(a.telepon||'').replace(/\D/g,'')||String(a.email).toLowerCase();if(!orderGroups.has(key))orderGroups.set(key,{id:'ACCOUNT:'+a.id_akun,name:a.nama,phone:a.telepon||'',event:'-',eventDate:'',points:0,totalSpend:0,interactions:[],orderCount:0,isAccount:true});else{const c=orderGroups.get(key);c.name=a.nama;c.isAccount=true;c.accountId=a.id_akun;}});
            const crmCustomers=[...state.customers,...[...orderGroups.values()].filter(o=>!state.customers.some(c=>String(c.phone||'').replace(/\D/g,'')===String(o.phone||'').replace(/\D/g,'')))];
            const query=(document.getElementById('crmSearchInput')?.value||'').toLowerCase();const customers=crmCustomers.filter(c=>`${c.name} ${c.phone} ${c.event}`.toLowerCase().includes(query));
            const total=document.getElementById('crmTotalCustomers');if(total)total.textContent=`${customers.length} Pelanggan`;
            customers.forEach(c => {const last=(c.interactions||[]).at(-1);const isManual=state.customers.some(x=>String(x.id)===String(c.id));tbody.innerHTML += `<tr><td class="p-3 font-bold">${escapeHTML(c.name)}${c.isAccount?'<span class="ml-1 rounded bg-blue-50 px-1 text-[9px] text-blue-700">AKUN</span>':''}</td><td class="p-3">${escapeHTML(c.phone)}</td><td class="p-3">${escapeHTML(c.event||'-')}<div class="text-[10px] text-slate-400">${escapeHTML(c.eventDate||'')}</div></td><td class="p-3 font-bold">${formatRp(c.totalSpend)}</td><td class="p-3 max-w-48">${last?`<span>${escapeHTML(last.note)}</span><div class="text-[10px] text-slate-400">${escapeHTML(last.date)}</div>`:`${c.orderCount?`${c.orderCount} pesanan tercatat`:'-'}`}</td><td class="p-3 text-right">${isManual?`<button onclick="editCrmCustomer('${escapeHTML(c.id)}')" class="mr-2 text-blue-600" aria-label="Ubah pelanggan"><i class="fa-solid fa-pen"></i></button><button onclick="deleteCrmCustomer('${escapeHTML(c.id)}')" class="text-rose-600" aria-label="Hapus pelanggan"><i class="fa-solid fa-trash"></i></button>`:`<button onclick="showCrmOrderHistory('${safeHandlerArg(c.phone)}')" class="text-purple-600">Riwayat</button>`}</td></tr>`;});
            
            const rList = document.getElementById('crmReminderList'); if(rList) {
                rList.innerHTML = ''; state.customers.filter(c=>c.eventDate).forEach(c => rList.innerHTML += `<div class="p-3 border rounded-xl bg-slate-50"><div class="flex justify-between text-xs font-bold"><span>${escapeHTML(c.name)}</span><span class="text-rose-600">${escapeHTML(c.eventDate)}</span></div><a href="https://wa.me/${String(c.phone).replace(/\D/g,'')}" target="_blank" rel="noopener" class="mt-2 inline-block text-[10px] text-emerald-700">Kirim pengingat WhatsApp</a></div>`);
            }
        }
        function showCrmOrderHistory(phone){const key=String(phone||'').replace(/\D/g,'');const orders=getAllOrders().filter(o=>String(o.customerPhone||'').replace(/\D/g,'')===key);alert(orders.length?orders.map(o=>`${o.id} · ${o.status} · ${o.paymentStatus} · ${formatRp(o.total)}`).join('\n'):'Belum ada pesanan.');}
        function openCustomerModal() { document.querySelector('#modalCustomer form').reset();document.getElementById('mCustId').value='';document.getElementById('modalCustomer').classList.remove('hidden'); }
        function editCrmCustomer(id){const c=state.customers.find(item=>String(item.id)===String(id));if(!c)return;document.getElementById('mCustId').value=c.id;document.getElementById('mCustName').value=c.name;document.getElementById('mCustPhone').value=c.phone;document.getElementById('mCustEventType').value=c.event;document.getElementById('mCustEventDate').value=c.eventDate||'';document.getElementById('mCustInteraction').value='';document.getElementById('modalCustomer').classList.remove('hidden');}
        function deleteCrmCustomer(id){if(!confirm('Hapus data CRM pelanggan ini? Riwayat pesanan online tetap tersimpan.'))return;state.customers=state.customers.filter(c=>String(c.id)!==String(id));saveState();showAdminToast('Data CRM dihapus.');}
        function saveCustomer(e) {
            e.preventDefault();
            const id=document.getElementById('mCustId').value;let customer=state.customers.find(c=>String(c.id)===String(id));if(!customer){customer={id:'CUST-'+Date.now(),points:0,totalSpend:0,interactions:[]};state.customers.unshift(customer);}customer.name=document.getElementById('mCustName').value.trim();customer.phone=document.getElementById('mCustPhone').value.trim();customer.event=document.getElementById('mCustEventType').value;customer.eventDate=document.getElementById('mCustEventDate').value;const note=document.getElementById('mCustInteraction').value.trim();if(note){customer.interactions=customer.interactions||[];customer.interactions.push({date:new Date().toISOString().slice(0,10),note});}
            closeAdminModal('modalCustomer'); saveState(); showAdminToast("Pelanggan disimpan!");
        }

        /* FINANCE */
        function renderFinanceTable() {
            const tbody = document.getElementById('financeTableBody'); if(!tbody) return; tbody.innerHTML = '';
            let tIn=0, tOut=0;
            const ledger=[...state.finance,...webOrdersCache.filter(o=>o.status_pembayaran==='Lunas').map(o=>({date:String(o.dibuat_pada||'').slice(0,10),desc:`Penjualan ${o.nomor_pesanan}`,type:'IN',category:'Penjualan',amount:Number(o.total||0)}))];
            ledger.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
            ledger.forEach(f => {
                const amount=Number(f.amount)||0;
                if(f.type==='IN') tIn += amount; else tOut += amount;
                tbody.innerHTML += `<tr><td class="p-3">${escapeHTML(f.date)}</td><td class="p-3 font-bold">${escapeHTML(f.desc)}</td><td class="p-3"><span class="px-2 rounded text-[10px] ${f.type==='IN'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}">${f.type}</span></td><td class="p-3 text-right font-bold ${f.type==='IN'?'text-emerald-600':'text-rose-600'}">${formatRp(amount)}</td></tr>`;
            });
            document.getElementById('financeIncome').innerText = formatRp(tIn);
            document.getElementById('financeExpense').innerText = formatRp(tOut);
            document.getElementById('financeNetProfit').innerText = formatRp(tIn - tOut);
        }
        function openExpenseModal() { document.getElementById('modalExpense').classList.remove('hidden'); }
        function saveExpense(e) {
            e.preventDefault();
            state.finance.unshift({ date: new Date().toISOString().split('T')[0], desc: document.getElementById('mExpenseDesc').value, type: 'OUT', category: document.getElementById('mExpenseCat').value, amount: parseFloat(document.getElementById('mExpenseAmount').value) });
            closeAdminModal('modalExpense'); saveState(); showAdminToast("Pengeluaran dicatat!");
        }
