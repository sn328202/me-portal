/**
 * The share sheet, saved as a picture.
 *
 * Printing was the first answer: every platform has "Save as PDF" in its
 * print dialog, so it cost nothing to ship. But a print dialog throws away
 * the thing that made the sheet worth sending — the colour. Browsers drop
 * backgrounds by default, staple on their own header and footer, and
 * paginate a modal into four identical sheets of paper.
 *
 * So the sheet is photographed instead. What you see in the preview is
 * exactly what lands in the file, because the file is made from the very
 * nodes on screen. One tall image, no pages, no dialog, and it drops
 * straight into a message.
 */

/** A filename someone can find again in their downloads. */
export const shotName = (title, date) => {
    const slug = String(title || 'day')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'day';

    const stamp = /^\d{4}-\d{2}-\d{2}/.test(String(date || '')) ? String(date).slice(0, 10) : '';

    return `${slug}${stamp ? `-${stamp}` : ''}.png`;
};

/**
 * The size to photograph at.
 *
 * The sheet lives inside a scroller that is capped at part of the viewport,
 * so its visible height is not its real height. `scrollHeight` is, and the
 * capture has to be told, or the picture stops where the scrollbar did.
 */
export const shotSize = (node) => {
    if (!node) return { width: 0, height: 0 };
    return {
        width: Math.ceil(Math.max(node.scrollWidth || 0, node.offsetWidth || 0)),
        height: Math.ceil(Math.max(node.scrollHeight || 0, node.offsetHeight || 0)),
    };
};

/**
 * How big to draw it.
 *
 * Two device pixels per CSS pixel is the difference between text that reads
 * on a phone and text that looks like a screenshot of a screenshot. Very
 * long trips are held under a ceiling so the browser does not run out of
 * canvas halfway through and hand back a blank image.
 */
export const shotScale = (height, cap = 12000) => {
    if (!height || height <= 0) return 2;
    return height * 2 > cap ? Math.max(1, cap / height) : 2;
};

/** Whether this browser can hand a picture to the share sheet. */
export const canShareImage = (file) => {
    try {
        return Boolean(navigator?.canShare?.({ files: [file] }) && navigator?.share);
    } catch {
        return false;
    }
};

/**
 * Photograph a node and give it to her.
 *
 * Native share where it exists — on a phone that is the whole point, it goes
 * to the message she was going to send anyway. A download everywhere else.
 */
export const saveSheetImage = async (node, { name = 'day.png', background, title } = {}) => {
    if (!node) throw new Error('nothing to photograph');

    const { domToBlob } = await import('modern-screenshot');
    const { width, height } = shotSize(node);

    const blob = await domToBlob(node, {
        width,
        height,
        scale: shotScale(height),
        backgroundColor: background || undefined,
        type: 'image/png',
        // The buttons under the preview are not part of the document.
        filter: (el) => !(el?.classList?.contains?.('no-print')),
    });

    if (!blob) throw new Error('the picture came out empty');

    const file = new File([blob], name, { type: 'image/png' });

    if (canShareImage(file)) {
        try {
            await navigator.share({ files: [file], title: title || undefined });
            return 'shared';
        } catch (err) {
            // A cancelled share is not a failure, and it is not a reason to
            // then download something she said no to.
            if (err?.name === 'AbortError') return 'cancelled';
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    return 'saved';
};
