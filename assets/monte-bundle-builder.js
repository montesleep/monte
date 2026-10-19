import { DialogElement } from './theme.js';

const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value / 100);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

class MonteBuilderDialog extends DialogElement {
  get shouldLock() { return true; }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('aria-modal','true');
    this.addEventListener('click', event => { if (event.target.closest('[data-dialog-close]')) this.hide(); }, { signal: this._abortController.signal });
  }
  disconnectedCallback() { this.unlock(); super.disconnectedCallback(); }
  lock() {
    if (this.savedBody) return;
    this.scrollY = window.scrollY;
    this.savedBody = ['position','top','width','overflow'].map(key => [key, document.body.style[key]]);
    Object.assign(document.body.style, { position:'fixed', top:`-${this.scrollY}px`, width:'100%', overflow:'hidden' });
  }
  unlock() {
    if (!this.savedBody) return;
    this.savedBody.forEach(([key,value]) => document.body.style[key] = value);
    this.savedBody = null; window.scrollTo(0, this.scrollY);
  }
  async transition(open, animate = true) {
    this.animations?.forEach(animation => animation.cancel());
    const panel = this.querySelector('.mb-dialog-panel'), overlay = this.querySelector('.mb-overlay');
    const mobile = matchMedia('(max-width:999px)').matches;
    const transform = this.hasAttribute('data-summary-dialog') ? 'translateY(100%)' : mobile ? 'translateX(100%)' : 'translateY(24px)';
    const duration = animate && !matchMedia('(prefers-reduced-motion:reduce)').matches ? 400 : 0;
    const frames = open ? [{transform,opacity:0},{transform:'translate(0)',opacity:1}] : [{transform:'translate(0)',opacity:1},{transform,opacity:0}];
    this.animations = [panel.animate(frames,{duration,easing:'cubic-bezier(.25,1,.5,1)',fill:'both'}),overlay.animate(open ? [{opacity:0},{opacity:1}] : [{opacity:1},{opacity:0}],{duration,fill:'both'})];
    await Promise.all(this.animations.map(animation => animation.finished.catch(() => {})));
    if (!open && !this.open) { this.style.display = 'none'; this.unlock(); }
  }
  _showTransition(animate) { this.lock(); this.style.display = this.hasAttribute('data-summary-dialog') ? 'flex' : 'block'; return this.transition(true,animate); }
  _hideTransition() { return this.transition(false); }
}

class MonteBundleBuilder extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController(); this.config = JSON.parse(this.querySelector('[data-builder-config]').textContent);
    this.products = new Map(); this.selected = new Map(); this.quantities = new Map(); this.cache = new Map();
    this.catalog = this.querySelector('[data-catalog-container]'); this.quick = this.querySelector('[data-quickview]');
    this.readProducts(); this.restore(); this.render();
    this.addEventListener('click', event => this.onClick(event), {signal:this.abort.signal});
    this.filter = document.querySelector('[data-bundle-filter]');
    this.filter?.addEventListener('click', event => {
      const link = event.target.closest('a'); if (!link) return;
      event.preventDefault(); this.changeCategory(link.dataset.category || new URL(link.href).pathname.split('/').pop(), true);
    }, {signal:this.abort.signal});
    window.addEventListener('popstate', () => this.changeCategory(new URL(location.href).searchParams.get('category') || 'all'),{signal:this.abort.signal});
    window.addEventListener('pageshow', () => { this.checkingOut=false; this.render(); },{signal:this.abort.signal});
    const category = new URL(location.href).searchParams.get('category') || 'all';
    if (category !== 'all') this.changeCategory(category); else this.markCategory(category);
  }
  disconnectedCallback() { this.abort?.abort(); this.catalogRequest?.abort(); this.quickRequest?.abort(); }
  readProducts(root = this.catalog) {
    root.querySelectorAll('[data-builder-product]').forEach(script => {
      try { const product = JSON.parse(script.textContent); this.products.set(String(product.id),product); } catch(error) { console.error('Invalid bundle product',error); }
    });
  }
  restore() {
    try {
      const items = JSON.parse(sessionStorage.getItem('monte-builder-selection') || '[]');
      items.forEach(([product,quantity]) => {
        const current = this.products.get(String(product.id)) || product;
        if (current.available && current.maximum > 0) { this.products.set(String(current.id),current); this.selected.set(String(current.id),Math.min(quantity,current.maximum)); }
      });
    } catch(error) { /* Storage can be unavailable in private browsing. */ }
  }
  persist() { try { sessionStorage.setItem('monte-builder-selection',JSON.stringify([...this.selected].map(([id,qty])=>[this.products.get(id),qty]))); } catch(error) {} }
  quantity(id) { return this.selected.get(id) || this.quantities.get(id) || 1; }
  update(id, quantity, select = false) {
    const product = this.products.get(id); if (!product?.available) return;
    const qty = Math.max(1,Math.min(quantity,product.maximum));
    this.quantities.set(id,qty); if (select || this.selected.has(id)) this.selected.set(id,qty);
    this.persist(); this.render();
  }
  remove(id) { this.selected.delete(id); this.quantities.set(id,1); this.persist(); this.render(); }
  onClick(event) {
    const target = event.target.closest('button,a'); if (!target) return;
    const owner = target.closest('[data-id]'), id = owner?.dataset.id;
    if (target.matches('[data-builder-step]') && id) this.update(id,this.quantity(id)+Number(target.dataset.builderStep));
    else if (target.matches('[data-builder-add]') && id) this.selected.has(id) ? this.remove(id) : this.update(id,this.quantity(id),true);
    else if (target.matches('[data-builder-remove]') && id) this.remove(id);
    else if (target.matches('[data-builder-preview]') && id) this.openQuick(id);
    else if (target.matches('[data-quick-add]') && this.quickId) { this.update(this.quickId,this.quantity(this.quickId)+ (this.selected.has(this.quickId)?1:0),true); this.quick.hide(); }
    else if (target.matches('[data-builder-checkout]')) this.checkout();
    else if (target.matches('[data-builder-more]')) { event.preventDefault(); this.loadCatalog(target.href,true); }
  }
  totals() {
    let subtotal=0, compare=0;
    this.selected.forEach((qty,id)=>{const p=this.products.get(id);subtotal+=p.price*qty;compare+=Math.max(p.price,p.compare)*qty;});
    const tier=this.config.thresholds.reduce((level,amount,index)=>subtotal>=amount?index+1:level,0);
    const total=[...this.selected].reduce((sum,[id,qty])=>sum+Math.round(this.products.get(id).price*qty*(100-tier*5)/100),0);
    return {subtotal,compare,total,tier};
  }
  render() {
    const {subtotal,compare,total,tier}=this.totals();
    this.querySelectorAll('[data-subtotal]').forEach(el=>el.textContent=money(subtotal));
    this.querySelectorAll('[data-savings]').forEach(el=>el.textContent=money(compare-total));
    this.querySelectorAll('[data-total]').forEach(el=>el.textContent=money(total));
    this.querySelectorAll('[data-goal-title]').forEach(el=>el.textContent=tier===3?this.config.successText:this.config.progressText.replace('[amount]',money(this.config.thresholds[tier]-subtotal)).replace('[percent]',(tier+1)*5));
    this.querySelectorAll('[data-tier]').forEach(el=>{
      const index=Number(el.dataset.tier),start=this.config.thresholds[index-1]||0,end=this.config.thresholds[index];
      const progress=Math.max(0,Math.min(100,(subtotal-start)/(end-start)*100));
      el.style.width=`${progress}%`;el.parentElement.setAttribute('aria-valuenow',Math.round(progress));
    });
    this.querySelectorAll('[data-builder-checkout]').forEach(el=>el.disabled=!this.selected.size || this.checkingOut);
    this.querySelectorAll('[data-builder-empty]').forEach(el=>el.hidden=!!this.selected.size);
    this.querySelectorAll('[data-builder-lines]').forEach(el=>{
      el.hidden=!this.selected.size;
      const existing=new Map([...el.children].map(row=>[row.dataset.id,row]));
      for (const [id,qty] of this.selected) {
        const p=this.products.get(id);let row=existing.get(id);
        if (!row) {
          row=document.createElement('div');row.className='mb-line';row.dataset.id=id;
          row.innerHTML=`<img src="${escapeHTML(p.image)}" width="64" height="64" alt=""><div class="mb-line-content"><div class="mb-line-title"><strong>${escapeHTML(p.title)}</strong><small>Kolor: ${escapeHTML(p.color)}</small></div><div class="mb-line-bottom"><div class="mb-quantity"><button type="button" data-builder-step="-1" aria-label="Zmniejsz ilość"><img src="${escapeHTML(this.config.minus)}" width="12" height="12" alt=""></button><output data-builder-quantity></output><button type="button" data-builder-step="1" aria-label="Zwiększ ilość"><img src="${escapeHTML(this.config.plus)}" width="12" height="12" alt=""></button></div><div class="mb-line-price"><s></s><span></span></div></div></div><button class="mb-remove" type="button" data-builder-remove aria-label="Usuń ${escapeHTML(p.title)} — ${escapeHTML(p.color)}"><img src="${escapeHTML(this.config.trash)}" width="16" height="16" alt=""></button>`;
          el.append(row);
        }
        row.querySelector('.mb-line-price span').textContent=money(p.price*qty);
        row.querySelector('s').textContent=p.compare>p.price?money(p.compare*qty):'';
        existing.delete(id);
      }
      existing.forEach(row=>row.remove());
    });
    this.querySelectorAll('[data-id]').forEach(row=>{
      const id=row.dataset.id,p=this.products.get(id); if(!p)return;
      const qty=this.quantity(id);row.querySelector('[data-builder-quantity]').textContent=qty;
      row.querySelector('[data-builder-step="-1"]').disabled=qty<=1;
      row.querySelector('[data-builder-step="1"]').disabled=qty>=p.maximum;
      const button=row.querySelector('[data-builder-add]');
      if(button){const selected=this.selected.has(id);button.classList.toggle('mb-button--outline',selected);button.querySelector('[data-add-label]').textContent=!p.available?'Wyprzedane':selected?'Usuń':'Dodaj';button.querySelector('[data-add-icon]').innerHTML=selected?`<img src="${escapeHTML(this.config.trash)}" width="16" height="16" alt="">`:'+';}
    });
    this.querySelector('[data-builder-status]').textContent=`W zestawie: ${[...this.selected.values()].reduce((a,b)=>a+b,0)}. ${money(total)}`;
  }
  markCategory(category) {
    this.filter?.querySelectorAll('a').forEach(link=>{const active=(link.dataset.category||new URL(link.href).pathname.split('/').pop())===category;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  }
  async changeCategory(category,push=false) {
    if(!/^[a-z0-9-]+$/.test(category))category='all';
    this.category=category;this.markCategory(category);
    if(push){const url=new URL(location.href);category==='all'?url.searchParams.delete('category'):url.searchParams.set('category',category);history.pushState({},'',url);}
    const root=window.Shopify?.routes?.root||'/'; await this.loadCatalog(`${root}collections/${category}?section_id=monte-bundle-catalog`);
  }
  async loadCatalog(address,append=false) {
    this.catalogRequest?.abort(); const request=this.catalogRequest=new AbortController();
    this.catalog.setAttribute('aria-busy','true');this.error('');
    try {
      const url=new URL(address,location.origin);url.searchParams.set('section_id','monte-bundle-catalog');
      const response=await fetch(url,{signal:request.signal});if(!response.ok)throw new Error('Catalog request failed');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html'), catalog=doc.querySelector('[data-builder-catalog]');
      if(!catalog)throw new Error('Missing catalog');
      this.readProducts(catalog);
      if(append){this.catalog.querySelector('.mb-grid').append(...catalog.querySelector('.mb-grid').children);this.catalog.querySelector('[data-builder-more]')?.remove();const more=catalog.querySelector('[data-builder-more]');if(more)this.catalog.querySelector('[data-builder-catalog]').append(more);}
      else this.catalog.replaceChildren(catalog);
      this.render();
    }catch(error){if(error.name!=='AbortError')this.error(this.config.errorText);}
    finally{if(this.catalogRequest===request)this.catalog.removeAttribute('aria-busy');}
  }
  error(message){this.querySelectorAll('[data-builder-error]').forEach(el=>{el.textContent=message;el.hidden=!message;});}
  async openQuick(id) {
    const product=this.products.get(id);this.quickId=id;this.quickRequest?.abort();const request=this.quickRequest=new AbortController();
    this.querySelector('[data-quick-title]').textContent=product.title;
    const content=this.querySelector('[data-quick-content]'),button=this.querySelector('[data-quick-add]');
    content.innerHTML='<p class="mb-quick-loading" role="status">Ładowanie…</p>';button.disabled=true;this.quick.show();
    try {
      let html=this.cache.get(product.url);
      if(!html){const response=await fetch(product.url,{signal:request.signal});if(!response.ok)throw new Error('Product request failed');html=await response.text();this.cache.set(product.url,html);}
      if(request.signal.aborted)return;
      const doc=new DOMParser().parseFromString(html,'text/html'),source=doc.querySelector('monte-product-hero');
      if(!source)throw new Error('Missing product content');
      const hero=document.createElement('monte-product-hero');hero.className='mp';
      const layout=document.createElement('div');layout.className='mp-layout';const info=document.createElement('div');info.className='mp-info';
      const gallery=source.querySelector('.mp-gallery');if(gallery)layout.append(gallery.cloneNode(true));
      ['.mp-intro','.mp-tabs','.mp-ugc','.mp-faq'].forEach(selector=>{
        const node=source.querySelector(selector);if(!node)return;
        const wrapper=node.closest('reveal-items');info.append((wrapper&&wrapper!==source?wrapper:node).cloneNode(true));
      });
      layout.append(info);hero.append(layout);hero.querySelectorAll('script').forEach(node=>node.remove());
      hero.querySelectorAll('[data-shopify-editor-block]').forEach(node=>node.removeAttribute('data-shopify-editor-block'));
      content.replaceChildren(hero);content.scrollTop=0;button.disabled=!product.available || this.quantity(id)>=product.maximum&&this.selected.has(id);
    }catch(error){if(error.name!=='AbortError'){content.innerHTML=`<p class="mb-quick-loading">${escapeHTML(this.config.errorText)} <a href="${escapeHTML(product.url)}">Zobacz produkt</a></p>`;}}
  }
  async checkout() {
    if(this.checkingOut||!this.selected.size)return;
    this.checkingOut=true;this.error('');this.render();
    try {
      const root=window.Shopify?.routes?.root||'/';
      const cartResponse=await fetch(`${root}cart.js`);if(!cartResponse.ok)throw new Error(this.config.errorText);
      const cart=await cartResponse.json(),remaining=new Map(this.selected),updates={};
      // Reconcile only this builder's lines, preserving unrelated cart items.
      for(const line of cart.items){
        if(line.properties?._monte_bundle_builder!=='true')continue;
        const id=String(line.variant_id);updates[line.key]=remaining.get(id)||0;remaining.delete(id);
      }
      if(Object.keys(updates).length){
        const response=await fetch(`${root}cart/update.js`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updates})});
        const result=await response.json();if(!response.ok)throw new Error(result.description||this.config.errorText);
      }
      if(remaining.size){
        const items=[...remaining].map(([id,quantity])=>({id:Number(id),quantity,properties:{_monte_bundle_builder:'true'}}));
        const response=await fetch(`${root}cart/add.js`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
        const result=await response.json();if(!response.ok)throw new Error(result.description||this.config.errorText);
      }
      location.assign(this.config.discountCode?`${root}discount/${encodeURIComponent(this.config.discountCode)}?redirect=/checkout`:`${root}checkout`);
    }catch(error){this.error(error.message||this.config.errorText);this.checkingOut=false;this.render();}
  }
}
if(!customElements.get('monte-builder-dialog'))customElements.define('monte-builder-dialog',MonteBuilderDialog);
if(!customElements.get('monte-bundle-builder'))customElements.define('monte-bundle-builder',MonteBundleBuilder);
