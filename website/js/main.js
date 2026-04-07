/* ============================================
   NO LIMIT SAFETY — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ========== MOBILE MENU ==========
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('open');
      document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
    });

    // Close menu on link click
    navMenu.querySelectorAll('a:not(.nav-dropdown > a)').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    // Mobile dropdown toggle
    document.querySelectorAll('.nav-dropdown > a').forEach(dropdownToggle => {
      dropdownToggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdownToggle.parentElement.classList.toggle('open');
        }
      });
    });
  }

  // ========== STICKY HEADER SHADOW ==========
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // ========== SCROLL REVEAL ANIMATIONS ==========
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ========== COUNTER ANIMATION ==========
  const counters = document.querySelectorAll('.stat-number[data-target]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counter = entry.target;
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(eased * target);

          counter.textContent = current + '+';

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            counter.textContent = target + '+';
          }
        };

        requestAnimationFrame(animate);
        counterObserver.unobserve(counter);
      }
    });
  }, {
    threshold: 0.5
  });

  counters.forEach(counter => counterObserver.observe(counter));

  // ========== FORM HANDLING ==========
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(contactForm);
      const data = {};
      formData.forEach((value, key) => { data[key] = value; });

      // Simple validation
      const required = contactForm.querySelectorAll('[required]');
      let valid = true;

      required.forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = '#e74c3c';
          valid = false;
        } else {
          field.style.borderColor = '';
        }
      });

      if (!valid) return;

      // Success feedback
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Bericht verzonden!';
      btn.style.background = '#27ae60';
      btn.disabled = true;

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.disabled = false;
        contactForm.reset();
      }, 3000);
    });

    // Remove error styling on input
    contactForm.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('input', () => {
        field.style.borderColor = '';
      });
    });
  }

  // ========== SMOOTH SCROLL FOR ANCHOR LINKS ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ========== CLOSE DROPDOWN ON OUTSIDE CLICK ==========
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      document.querySelectorAll('.nav-dropdown').forEach(dd => {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
        }
      });
    }
  });

});
