if (!customElements.get("quick-add-lookbook-modal")) {
  customElements.define(
    "quick-add-lookbook-modal",
    class QuickAddLookbookModal extends ModalDialog {
      constructor() {
        super();
        this.modalContent = this.querySelector('[id^="QuickAddLookbookInfo-"]');
      }

      hide(preventFocus = false) {
        // Clear the content every time the modal is closed
        if (this.modalContent) this.modalContent.innerHTML = "";
        if (preventFocus) this.openedBy = null;
        super.hide();
      }

      show(opener) {
        opener.setAttribute("aria-disabled", true);
        opener.classList.add("loading");
        opener.querySelector(".loading__spinner").classList.remove("hidden");

        const urlsString = opener.getAttribute("data-products-urls");
        if (!urlsString) {
          console.error("No product URLs found.");
          this.cleanup(opener);
          return;
        }

        // 1. Split the attribute string into an array of clean URLs
        const urls = urlsString.split(",, ").filter((url) => url.trim() !== "");

        // 2. Create an array of fetch promises
        const fetchPromises = urls.map((url) =>
          fetch(url).then((response) => {
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            return response.text();
          })
        );

        // 3. Wait for all products to be fetched
        Promise.all(fetchPromises)
          .then((htmlStrings) => {
            // 4. Loop through each product's HTML response
            htmlStrings.forEach((responseText) => {
              const responseHTML = new DOMParser().parseFromString(
                responseText,
                "text/html"
              );
              const productElement = responseHTML.querySelector("product-info");

              if (productElement) {
                this.preprocessHTML(productElement);
                // 5. Append the cleaned product element to the modal content
                this.modalContent.appendChild(productElement);
              }
            });

            // Initialize scripts after all content is in the DOM
            if (window.Shopify && Shopify.PaymentButton)
              Shopify.PaymentButton.init();
            if (window.ProductModel) window.ProductModel.loadShopifyXR();

            // 6. Finally, show the modal
            super.show(opener);
          })
          .catch((error) =>
            console.error("Error fetching lookbook products:", error)
          )
          .finally(() => this.cleanup(opener));
      }

      cleanup(opener) {
        opener.removeAttribute("aria-disabled");
        opener.classList.remove("loading");
        opener.querySelector(".loading__spinner").classList.add("hidden");
      }

      preprocessHTML(productElement) {
        this.preventDuplicatedIDs(productElement);
        this.removeDOMElements(productElement);
        this.preventVariantURLSwitching(productElement);
      }

      preventVariantURLSwitching(productElement) {
        productElement.setAttribute("data-update-url", "false");
      }

      removeDOMElements(productElement) {
        const elementsToRemove = [
          "pickup-availability",
          "product-modal",
          "modal-dialog",
        ];
        elementsToRemove.forEach((selector) => {
          productElement
            .querySelectorAll(selector)
            .forEach((el) => el.remove());
        });
      }

      preventDuplicatedIDs(productElement) {
        const originalSectionId = productElement.dataset.section;
        if (!originalSectionId) return;

        // Get the unique product ID from the element's data attribute
        const productId = productElement.dataset.productId;
        if (!productId) return;

        // Create a new, truly unique ID string using BOTH the section and product ID
        const newId = `lookbook-${originalSectionId}-${productId}`;

        // Replace all occurrences of the old section ID inside the element's HTML
        productElement.innerHTML = productElement.innerHTML.replaceAll(
          originalSectionId,
          newId
        );

        // Update the data attributes on the parent <product-info> element
        productElement.dataset.originalSection = originalSectionId;
        productElement.dataset.section = newId;

        // Also update the main ID attribute of the <product-info> element itself
        if (
          productElement.id &&
          productElement.id.includes(originalSectionId)
        ) {
          productElement.id = productElement.id.replace(
            originalSectionId,
            newId
          );
        }
      }
    }
  );
}
