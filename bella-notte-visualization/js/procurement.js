/* ═══════════════════════════════════════════
   procurement.js — Shopping orders,
   Instacart products, Amazon Fresh products
═══════════════════════════════════════════ */

function renderProcurement(data) {
  const shopping    = data.shopping    || {};
  const instacart   = data.instacart   || {};
  const amazonFresh = data.amazonFresh || {};
  const el          = document.getElementById('procurement-content');

  let html = '';

  // ── Shopping Orders ───────────────────────
  const shOrders   = shopping.orders   || [];
  const shProducts = shopping.products || [];
  const shProdMap  = Object.fromEntries(
    shProducts.flatMap(p => Object.entries(p.variants || {}).map(([id, v]) => [id, { ...v, product_name: p.name, category: p.category, brand: p.brand }]))
  );

  if (shOrders.length > 0) {
    html += `<div style="margin-bottom:24px">
      <div class="section-label" style="margin-bottom:12px">Shopping Orders (${shOrders.length})</div>`;

    shOrders.forEach(order => {
      const items   = Object.entries(order.order_items || {});
      const totalItems = items.reduce((s, [, v]) => s + (v.quantity || 1), 0);
      html += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:14px;font-weight:600">${escHtml(order.order_id)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">${fmtTs(order.order_date)} · ${totalItems} item${totalItems!==1?'s':''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:700;color:var(--amber)">${fmtCurrency(order.order_total)}</div>
            <span class="badge ${order.order_status==='delivered'?'badge-emerald':'badge-amber'}">${escHtml(order.order_status)}</span>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
          <tbody>
            ${items.map(([itemId, v]) => {
              const prod = shProdMap[itemId] || {};
              return `<tr>
                <td>${escHtml(prod.product_name || itemId)}</td>
                <td class="dim">${escHtml(prod.category || '—')}</td>
                <td class="dim">${v.quantity || 1}</td>
                <td style="text-align:right" class="dim">${fmtCurrency(v.price)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
    });
    html += '</div>';
  }

  // ── Product Catalogs ─────────────────────
  html += '<div class="grid-2" style="gap:16px">';

  // Instacart
  const icProducts = instacart.products || [];
  if (icProducts.length > 0) {
    html += `<div>
      <div class="section-label" style="margin-bottom:10px">Instacart Products (${icProducts.length})</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Category</th><th>Unit</th><th style="text-align:right">Price</th></tr></thead>
        <tbody>
          ${icProducts.map(p => `<tr>
            <td>${escHtml(p.name)}</td>
            <td class="dim">${escHtml(p.category || '—')}</td>
            <td class="dim">${escHtml(p.unit || '—')}</td>
            <td style="text-align:right" class="dim">${fmtCurrency(p.price)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }

  // Amazon Fresh
  const afProducts = amazonFresh.products || [];
  if (afProducts.length > 0) {
    html += `<div>
      <div class="section-label" style="margin-bottom:10px">Amazon Fresh Products (${afProducts.length})</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Category</th><th>Organic</th><th style="text-align:right">Price</th></tr></thead>
        <tbody>
          ${afProducts.map(p => {
            const variants = amazonFresh.product_variants?.filter(v => v.product_id === p.product_id) || [];
            const price = variants[0]?.price ?? p.price ?? 0;
            return `<tr>
              <td>${escHtml(p.name)}</td>
              <td class="dim">${escHtml(p.category || '—')}</td>
              <td class="dim">${p.is_organic ? '✓' : '—'}</td>
              <td style="text-align:right" class="dim">${price ? fmtCurrency(price) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;
  }

  html += '</div>';

  if (!shOrders.length && !icProducts.length && !afProducts.length) {
    html = '<div class="empty-state">No procurement data available.</div>';
  }

  el.innerHTML = html;
}
