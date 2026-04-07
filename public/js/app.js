import { createApp, ref, onMounted, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { navData } from './data.js';

createApp({
    setup() {
        const columns = ref(navData);
        const isDarkMode = ref(false);

        const toggleTheme = () => {
            isDarkMode.value = !isDarkMode.value;
            applyTheme();
        };

        const applyTheme = () => {
            if (isDarkMode.value) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        };

        const initMaterialize = () => {
            // Materialize logic needs global M
            if (typeof M !== 'undefined') {
                var collapsibles = document.querySelectorAll('.collapsible');
                M.Collapsible.init(collapsibles, {
                    accordion: false,
                    inDuration: 300,
                    outDuration: 200
                });

                // Icon toggle logic
                collapsibles.forEach(function(collapsible) {
                    collapsible.addEventListener('click', function(e) {
                        const header = e.target.closest('.collapsible-header');
                        if (header) {
                            const icon = header.querySelector('.material-icons:last-child');
                            const li = header.parentElement;
                            
                            // Materialize toggles the class, check after a slight delay or use MutationObserver (timeout is simpler here)
                            setTimeout(() => {
                                if (li.classList.contains('active')) {
                                    icon.textContent = 'expand_more';
                                } else {
                                    icon.textContent = 'expand_less';
                                }
                            }, 50);
                        }
                    });
                });
            }
        };

        onMounted(() => {
            // Theme Init
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                isDarkMode.value = true;
            }
            applyTheme();

            // Materialize Init
            nextTick(() => {
                initMaterialize();
            });
        });

        return {
            columns,
            isDarkMode,
            toggleTheme
        };
    }
}).mount('#app');
