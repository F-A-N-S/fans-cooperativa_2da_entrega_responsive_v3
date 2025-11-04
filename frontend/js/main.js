// frontend/assets/js/main.js
var API = (window.API || window.API_URL) || "/api/api.php";
// --- FUNCIÓN showNotification (AHORA GLOBAL) ---
// Esta función se ha movido aquí para que sea accesible desde cualquier otro script (ej. auth.js, backoffice.js)
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000); // Desaparece después de 5 segundos
}
// --- FIN FUNCIÓN showNotification GLOBAL ---
(function () {
  const token = !!localStorage.getItem('token');

  // Botón/links de la derecha (Login/Register vs Mi panel/Cerrar sesión)
  const actions = document.querySelector('.header .header-actions');
  if (!actions) return;

  // Limpio acciones actuales y las repinto según haya token
  actions.innerHTML = '';
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'theme-toggle';
  toggleBtn.id = 'themeToggle';
  toggleBtn.setAttribute('aria-label', 'Cambiar tema');
  toggleBtn.innerHTML = '<span class="theme-icon">🌙</span>';
  actions.appendChild(toggleBtn);

  if (token) {
    const aPagos = document.createElement('a');
    aPagos.href = 'upload.html';
    aPagos.className = 'btn btn-outline';
    aPagos.textContent = 'Mis pagos';
    actions.appendChild(aPagos);

    const aPanel = document.createElement('a');
    aPanel.href = 'dashboard.html';
    aPanel.className = 'btn btn-primary';
    aPanel.textContent = 'Mi panel';
    actions.appendChild(aPanel);
  } else {
    const aLogin = document.createElement('a');
    aLogin.href = 'login.html';
    aLogin.className = 'btn btn-outline';
    aLogin.textContent = 'Iniciar Sesión';
    actions.appendChild(aLogin);

    const aReg = document.createElement('a');
    aReg.href = 'register.html';
    aReg.className = 'btn btn-primary';
    aReg.textContent = 'Registrarse';
    actions.appendChild(aReg);
  }
  if (token) {
  fetch(`${API}?action=me`, { headers: window.fansAuthHeaders() })
    .then(r => r.json()).then(d => {
      if (d?.user?.role === 'admin') {
        const aBO = document.createElement('a');
        aBO.href = 'backoffice.html';
        aBO.className = 'btn btn-outline';
        aBO.textContent = 'Backoffice';
        actions.appendChild(aBO);
      }
    }).catch(()=>{});
}
})();

(function addBackofficeLink() {
  const token = localStorage.getItem('fans_token') || localStorage.getItem('token');
  if (!token) return;
  const actions = document.querySelector('.nav-actions') || document.querySelector('nav');
  if (!actions) return;

  fetch((window.API_BASE_URL || window.API || '/api/api.php') + '?action=me', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json()).then(d => {
    if (d?.user?.role === 'admin') {
      if (!actions.querySelector('a[href="backoffice.html"]')) {
        const link = document.createElement('a');
        link.href = 'backoffice.html';
        link.textContent = 'Backoffice';
        link.className = 'btn btn-outline';
        actions.appendChild(link);
      }
    }
  }).catch(()=>{});
})();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Animaciones al hacer scroll (clase 'animate-on-scroll' y 'is-visible')
    const animateOnScrollElements = document.querySelectorAll('.animate-on-scroll');

    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px 0px -10% 0px', // Activa 10% antes de llegar al fondo del viewport
        threshold: 0.1 // 10% del elemento visible para activar
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible'); // Clase para activar la animación
                observer.unobserve(entry.target); // Dejar de observar una vez que se muestra
            }
        });
    }, observerOptions);

    animateOnScrollElements.forEach(element => {
        observer.observe(element);
    });

    // 2. Transiciones suaves al hacer clic en enlaces de navegación
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight; // Altura del header fijo
                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - headerHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Efecto para el header al hacer scroll
    const header = document.getElementById('header');

    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) { // Cuando el usuario scrollea más de 50px
                header.classList.add('scrolled'); // Añade la clase 'scrolled'
            } else {
                header.classList.remove('scrolled'); // Elimina la clase 'scrolled'
            }
        });
    }

    
    // 4. Mobile Menu Toggle (para responsive) — reforzado
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navigation = document.querySelector('.navigation');

    if (mobileMenuToggle && navigation) {
        const openMenu = () => {
            navigation.classList.add('active');
            mobileMenuToggle.classList.add('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'true');
        };
        const closeMenu = () => {
            navigation.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        };
        const isOpen = () => navigation.classList.contains('active');

        mobileMenuToggle.addEventListener('click', () => (isOpen() ? closeMenu() : openMenu()));

        // Cerrar al hacer click en cualquier enlace del menú
        navigation.addEventListener('click', (e) => {
            const link = e.target.closest('a, button[href]');
            if (link && isOpen()) closeMenu();
        });

        // Cerrar con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen()) closeMenu();
        });

        // Cerrar automáticamente si pasamos a desktop
        const mq = window.matchMedia('(min-width: 769px)');
        const handleChange = () => closeMenu();
        if (mq.addEventListener) mq.addEventListener('change', handleChange);
        else if (mq.addListener) mq.addListener(handleChange); // Soporte legacy
    }


    // 5. Efectos Hover para service cards
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
            this.style.boxShadow = '0 20px 50px var(--shadow-color)'; // Reaplicar sombra al hover
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 10px 30px var(--shadow-color)'; // Volver a la sombra normal
        });
    });

    // 6. Efecto Parallax para hero video
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroVideo = document.querySelector('.hero-video');
        
        if (heroVideo && scrolled < window.innerHeight) {
            heroVideo.style.transform = `translateY(${scrolled * 0.4}px)`; 
        }
    });

    // 7. Initialize animations on page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            document.querySelectorAll('.animate-on-scroll').forEach((el) => {
                if (el.getBoundingClientRect().top < window.innerHeight) {
                    el.classList.add('is-visible');
                }
            });
        }, 300); // Pequeño retraso para que los elementos se carguen
    });

    // 8. General body opacity for loading effect
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    window.addEventListener('load', () => {
        document.body.style.opacity = '1';
    });

    window.getCurrentUser = async function(){
  const r = await fetch(`${window.API}?action=me`, { headers: window.fansAuthHeaders() });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Sin sesión');
  // guardo algo útil en localStorage por si querés usar
  localStorage.setItem('fans_user_role', j.user.role);
  localStorage.setItem('fans_user_data', JSON.stringify(j.user));
  return j.user;
};

});