import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { GroupDetail } from "./pages/GroupDetail";
import { Links } from "./pages/Links";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/links" element={<Links />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
