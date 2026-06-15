export function normalizeImageUrl(url) {
  if (!url) return null;
  return url
    .replace(/&amp;/g, '&')
    .replace(/([?&])w=\d+/g, '')
    .replace(/([?&])h=\d+/g, '')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

export function isProductImage(url) {
  return /geilicdn\.com|wdstatic\.com|alicdn\.com|tbcdn\.cn/i.test(url || '');
}

export async function scrapeKakobuyPage(page, kakobuyUrl) {
  await page.goto(kakobuyUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.row .spec, .item-page, .component-box', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const data = await page.evaluate(() => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

    const titleCandidates = [
      document.querySelector('.goods-title'),
      document.querySelector('.item-title'),
      document.querySelector('.detail-title'),
      document.querySelector('.item-page h1'),
      document.querySelector('.item-page h2'),
    ].filter(Boolean);

    let title = titleCandidates.map((el) => clean(el.textContent)).find(Boolean) || null;

    if (!title) {
      const refreshBtn = [...document.querySelectorAll('button, .refresh-btn')].find((el) =>
        /refrescar|refresh/i.test(el.textContent || '')
      );
      if (refreshBtn?.parentElement) {
        title = clean(refreshBtn.parentElement.textContent).replace(/refrescar|refresh/gi, '').trim();
      }
    }

    const bodyText = document.body.innerText;
    const priceCny = bodyText.match(/CNY\s*[￥¥]?\s*([\d.,]+)/)?.[1] || null;
    const priceUsd = bodyText.match(/≈\s*\$\s*([\d.,]+)/)?.[1] || bodyText.match(/\$\s*([\d.,]+)/)?.[1] || null;

    const options = [...document.querySelectorAll('.row')]
      .map((row) => {
        const label = clean(row.querySelector('.title')?.textContent).replace(/:\s*$/, '');
        const values = [...row.querySelectorAll('.spec')]
          .map((spec) => ({
            name: clean(spec.getAttribute('title') || spec.textContent),
            image: spec.querySelector('img.props-image')?.src || null,
          }))
          .filter((v) => v.name);
        return { label, values };
      })
      .filter((group) => group.label && group.values.length);

    const gallery = [...document.querySelectorAll('.el-image__inner, .el-image__preview, img.props-image')].map(
      (img) => img.src
    );

    return { title, priceCny, priceUsd, options, gallery };
  });

  const optionImages = data.options.flatMap((g) => g.values.map((v) => v.image).filter(Boolean));
  const galleryImages = (data.gallery || []).filter(isProductImage);

  const images = [...new Set([...galleryImages, ...optionImages].map(normalizeImageUrl).filter(isProductImage))];

  const options = data.options.map((group) => ({
    label: group.label,
    values: group.values.map((v) => ({
      name: v.name,
      image: v.image ? normalizeImageUrl(v.image) : null,
    })),
  }));

  if (!data.title && images.length === 0 && options.length === 0) {
    throw new Error('No se pudo extraer información del producto');
  }

  return {
    title: data.title,
    priceCny: data.priceCny,
    priceUsd: data.priceUsd,
    images,
    options,
    variants: options.flatMap((group) =>
      group.values.map((v) => ({
        group: group.label,
        name: v.name,
        image: v.image,
      }))
    ),
  };
}
