import { Protected } from '../../components/protected';
import { ListingForm } from '../../components/listing-form';
export default function Page() { return <Protected><main className="page-wrap"><div className="page-banner"><p className="section-eyebrow">Give it a second life</p><h1>Sell an item</h1><p>Turn things you no longer need into someone else’s next great find.</p></div><div className="surface-panel"><ListingForm /></div></main></Protected>; }
