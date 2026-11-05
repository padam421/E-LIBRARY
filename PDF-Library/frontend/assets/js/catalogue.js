/* global React, ReactDOM */
(function () {
  "use strict";
  const h = React.createElement;
  const pageSize = 20;
  const apiOrigin = String(window.PDF_LIBRARY_CONFIG?.API_ORIGIN || "").replace(/\/$/, "");

  function App() {
    const [books, setBooks] = React.useState([]);
    const [status, setStatus] = React.useState("loading");
    const [request, setRequest] = React.useState(0);
    const [query, setQuery] = React.useState("");
    const [category, setCategory] = React.useState("");
    const [format, setFormat] = React.useState("");
    const [page, setPage] = React.useState(1);

    React.useEffect(function () {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let active = true;
      setStatus("loading");
      fetch(apiOrigin + "/api/pdfs", { signal: controller.signal })
        .then(function (response) {
          if (!response.ok) throw new Error("Catalogue unavailable");
          return response.json();
        })
        .then(function (data) {
          if (!Array.isArray(data)) throw new Error("Invalid catalogue");
          const valid = data.filter(book => book && Number.isSafeInteger(Number(book.id)) && Number(book.id) > 0 && typeof book.title === "string");
          if (active) {
            setBooks(valid.map(book => ({
              id: Number(book.id), title: book.title,
              author: typeof book.author === "string" ? book.author : "",
              category: typeof book.category === "string" && book.category.trim() ? book.category.trim() : "Uncategorized",
              has_pdf: book.has_pdf === true || book.has_pdf === 1,
              has_epub: book.has_epub === true || book.has_epub === 1,
            })).sort((a, b) => a.title.localeCompare(b.title)));
            setPage(1);
            setStatus("ready");
          }
        })
        .catch(function () { if (active) setStatus("error"); })
        .finally(() => clearTimeout(timer));
      return function () { active = false; clearTimeout(timer); controller.abort(); };
    }, [request]);

    const categories = React.useMemo(() => [...new Set(books.map(book => book.category))].sort(), [books]);
    const filtered = React.useMemo(function () {
      const text = query.trim().toLocaleLowerCase();
      return books.filter(book =>
        (!text || [book.title, book.author, book.category].join(" ").toLocaleLowerCase().includes(text)) &&
        (!category || book.category === category) &&
        (!format || book[format]));
    }, [books, query, category, format]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    function field(label, id, value, onChange, options) {
      const props = { id, value, className: options ? "form-select" : "form-control", onChange: e => { onChange(e.target.value); setPage(1); } };
      return h("div", { className: "col-md-4", key: id },
        h("label", { htmlFor: id, className: "form-label fw-semibold" }, label),
        options ? h("select", props, options.map(([value, text]) => h("option", { key: value, value }, text))) :
          h("input", { ...props, type: "search", maxLength: 200, placeholder: "Title, author or category" }));
    }

    if (status === "loading") return h("p", { role: "status", className: "alert alert-info" }, "Loading the catalogue. This may take a moment...");
    if (status === "error") return h("div", { role: "alert", className: "alert alert-warning" },
      h("p", null, "The catalogue could not be loaded. Please try again."),
      h("button", { type: "button", className: "btn btn-dark", onClick: () => setRequest(request + 1) }, "Retry"));

    return h(React.Fragment, null,
      h("section", { className: "row g-3 mb-4", "aria-label": "Collection overview" },
        [["Books in collection", books.length], ["Categories", categories.length], ["Matching books", filtered.length]].map(([label, value]) =>
          h("div", { className: "col-sm-4", key: label }, h("div", { className: "catalogue-stat bg-white p-3 rounded shadow-sm" },
            h("div", { className: "fs-3 fw-bold" }, value), h("div", { className: "text-secondary small" }, label))))),
      h("section", { className: "catalogue-controls bg-white p-4 rounded shadow-sm mb-4", "aria-label": "Filter books" },
        h("div", { className: "row g-3" },
          field("Search books", "catalogue-search", query, setQuery),
          field("Category", "catalogue-category", category, setCategory, [["", "All categories"], ...categories.map(item => [item, item])]),
          field("Reading format", "catalogue-format", format, setFormat, [["", "All formats"], ["has_pdf", "PDF"], ["has_epub", "EPUB"]])),
        h("div", { className: "d-flex flex-wrap gap-2 mt-3" },
          h("button", { type: "button", className: "btn btn-outline-secondary btn-sm", onClick: () => { setQuery(""); setCategory(""); setFormat(""); setPage(1); } }, "Clear filters"),
          h("button", { type: "button", className: "btn btn-outline-secondary btn-sm", onClick: () => setRequest(request + 1) }, "Refresh catalogue"),
          h("button", { type: "button", className: "btn btn-primary btn-sm", disabled: visible.length === 0, onClick: () => window.print() }, "Print this page"))),
      h("p", { className: "small text-secondary", role: "status", "aria-live": "polite" }, filtered.length + " matching books. Page " + currentPage + " of " + pageCount + "."),
      filtered.length === 0 ? h("p", { className: "alert alert-info" }, "No books match these filters.") :
        h("div", { className: "table-responsive bg-white rounded shadow-sm" },
          h("table", { className: "table table-hover mb-0 catalogue-table" },
            h("caption", { className: "visually-hidden" }, "E-Library book catalogue, sorted by title"),
            h("thead", null, h("tr", null, ["Book title", "Author", "Category", "Formats"].map(label => h("th", { key: label, scope: "col" }, label)))),
            h("tbody", null, visible.map(book => h("tr", { key: book.id },
              h("td", { className: "fw-semibold" }, h("a", { href: "book-detail.html?id=" + book.id }, book.title)),
              h("td", null, book.author || "Unknown"), h("td", null, book.category),
              h("td", null, [book.has_pdf && "PDF", book.has_epub && "EPUB"].filter(Boolean).join(" / ") || "Details")))))),
      h("nav", { className: "catalogue-pagination d-flex justify-content-between align-items-center mt-3", "aria-label": "Catalogue pages" },
        h("button", { type: "button", className: "btn btn-outline-dark btn-sm", disabled: currentPage === 1, onClick: () => setPage(currentPage - 1) }, "Previous"),
        h("span", { className: "small" }, "Page " + currentPage + " of " + pageCount),
        h("button", { type: "button", className: "btn btn-outline-dark btn-sm", disabled: currentPage === pageCount, onClick: () => setPage(currentPage + 1) }, "Next")));
  }

  ReactDOM.createRoot(document.getElementById("catalogue-root")).render(h(App));
}());
