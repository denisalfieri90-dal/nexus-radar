/** Script eseguiti nel <head> prima del primo disegno. Modulo server-safe (niente "use client"):
 *  importare queste stringhe da un componente client le trasformerebbe in riferimenti, non in testo. */

/** Applica subito il tema scelto: niente lampo di tema sbagliato. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('nexus-theme');if(t==='"light"'||t==='"dark"'){document.documentElement.dataset.theme=JSON.parse(t)}}catch(e){}})();`;

/** Cattura l'invito all'installazione di Android anche se arriva prima di React. */
export const installBootScript = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__nexusInstall=e;window.dispatchEvent(new Event('nexus-install-ready'))});`;
