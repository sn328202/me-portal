import React, { useState } from 'react';
import { GiShare, GiCheckMark, GiTrashCan } from 'react-icons/gi';
import { Button, Modal } from './ui';
import { useTripShares } from '../hooks/useTripShares';
import { shareUrl, isLive, describeViews } from '../utils/shareLink';
import '../styles/TripShare.css';

/**
 * Links to this trip, and what each one can do.
 *
 * A link is revoked rather than deleted, so "did the one I sent Mayur ever
 * get opened" survives turning it off — which is most of the reason to keep a
 * list of them at all.
 */
const TripShare = ({ trip }) => {
    const [open, setOpen] = useState(false);
    const { shares, create, revoke, error } = useTripShares(trip?.id);
    const [copied, setCopied] = useState(null);
    const [busy, setBusy] = useState(false);

    const origin = typeof window === 'undefined' ? '' : window.location.origin;

    const copy = async (token) => {
        const url = shareUrl(token, origin);
        try {
            /* The same race the Larder's Copy hit: in an unfocused tab
               `writeText` never settles at all, so `catch` never runs and a
               button that waits on it never changes. */
            await Promise.race([
                navigator.clipboard.writeText(url),
                new Promise((_, no) => setTimeout(() => no(new Error('slow')), 1200)),
            ]);
        } catch {
            const spill = document.createElement('textarea');
            spill.value = url;
            spill.setAttribute('readonly', '');
            spill.style.position = 'fixed';
            spill.style.opacity = '0';
            document.body.appendChild(spill);
            spill.select();
            try { document.execCommand('copy'); } catch { /* shown on screen anyway */ }
            document.body.removeChild(spill);
        }
        setCopied(token);
        setTimeout(() => setCopied(null), 2000);
    };

    const make = async () => {
        setBusy(true);
        const token = await create({ canEdit: false });
        setBusy(false);
        if (token) copy(token);
    };

    const live = shares.filter(isLive);

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)}>
                <GiShare /> Share
            </Button>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={`Share ${trip?.destination || 'this trip'}`}
                footer={<Button variant="ghost" onClick={() => setOpen(false)}>Done</Button>}
            >
                <div className="tripshare">
                    <p className="tripshare__lede">
                        Anyone with the link can read this trip — the days, the times, the
                        places and where you are staying. They do not need an account.
                    </p>

                    {error && <p className="tripshare__bad" role="alert">{error}</p>}

                    {live.length === 0 ? (
                        <p className="tripshare__none">No links yet.</p>
                    ) : (
                        <ul className="tripshare__list">
                            {live.map((s) => (
                                <li key={s.token}>
                                    <code className="tripshare__url">{shareUrl(s.token, origin)}</code>
                                    <span className="tripshare__meta">{describeViews(s)}</span>
                                    <span className="tripshare__acts">
                                        <Button size="sm" variant="ghost" onClick={() => copy(s.token)}>
                                            {copied === s.token ? <><GiCheckMark /> Copied</> : 'Copy'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            label="Turn this link off"
                                            onClick={() => revoke(s.token)}
                                        >
                                            <GiTrashCan />
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Button variant="primary" onClick={make} disabled={busy}>
                        <GiShare /> {busy ? 'Making a link…' : 'Make a link'}
                    </Button>

                    <p className="tripshare__quiet">
                        Turning a link off stops it working straight away. Anything already
                        opened stays on that person&rsquo;s screen until they reload.
                    </p>
                </div>
            </Modal>
        </>
    );
};

export default TripShare;
