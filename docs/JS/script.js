const CART_STORAGE_KEY = 'rajvanCart';
const LAST_ORDER_STORAGE_KEY = 'rajvanLastOrder';
const ORDERS_STORAGE_KEY = 'rajvanOrders';
const WISHLIST_STORAGE_KEY = 'rajvanWishlist';
const USERS_STORAGE_KEY = 'rajvanUsers';
const ACTIVE_USER_STORAGE_KEY = 'rajvanActiveUser';
const STORE_OWNER_EMAIL = 'raj28van@gmail.com';
const UPI_MERCHANT_NAME = 'RajVan Jewelry';
const UPI_ID = 'rajvanjewelry@upi';
const EMAILJS_CONFIG = {
    publicKey: 'DtOQrkX7xk0TyCvXD',
    serviceId: 'service_i4ezlwb',
    customerTemplateId: 'template_ilr8yyw',
    ownerTemplateId: 'template_r79vvbn',
};
const sentEmailOrderIds = new Set();

const formatPrice = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

const getEmailJSConfig = () => ({
    publicKey: EMAILJS_CONFIG.publicKey?.trim() || '',
    serviceId: EMAILJS_CONFIG.serviceId?.trim() || '',
    customerTemplateId: EMAILJS_CONFIG.customerTemplateId?.trim() || '',
    ownerTemplateId: EMAILJS_CONFIG.ownerTemplateId?.trim() || '',
});

const getEmailJSConfigIssues = () => {
    const config = getEmailJSConfig();
    const requiredFields = {
        publicKey: 'EmailJS Public Key',
        serviceId: 'EmailJS Service ID',
        customerTemplateId: 'Customer Template ID',
        ownerTemplateId: 'Store Owner Template ID',
    };

    return Object.entries(requiredFields)
        .filter(([key]) => !config[key] || config[key].startsWith('YOUR_'))
        .map(([, label]) => label);
};

const isEmailJSConfigured = () => getEmailJSConfigIssues().length === 0;

const getCart = () => {
    try {
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
};

const saveCart = (cart) => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
};

const buildCartKey = (product) => [
    product.id,
    product.color || 'Gold',
    product.customName || '',
    product.font || '',
    product.pendantType || '',
    product.connector || '',
    product.customNameTwo || '',
    product.chainType || '',
    product.chainLength || '',
    product.pendantStyle || product.pendantSize || '',
    product.bangleSize || '',
    product.bangleStyle || '',
].join('|');

const getStoredOrders = () => {
    try {
        return JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
};

const saveOrder = (order) => {
    const orders = getStoredOrders();
    orders.push(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const getProductsText = (cart) => cart.map((item) => {
    const details = getCartDetails(item).join(', ');
    return `${item.name}${details ? ` (${details})` : ''} - Qty ${item.quantity} - ${formatPrice(item.price * item.quantity)}`;
}).join('\n');

const getFullAddress = (customer) => `${customer.address}, ${customer.city}, ${customer.state} - ${customer.pin}`;

const getProductEmailDetails = (cart) => cart.map((item, index) => {
    const customizationDetails = getCartDetails(item);
    const details = [
        `Product ${index + 1}: ${item.productName || item.name}`,
        `Display Name: ${item.displayName || item.customName || item.name}`,
        `Customization Details: ${customizationDetails.length ? customizationDetails.join(' | ') : 'Not customized'}`,
        `Font: ${item.font || 'Not selected'}`,
        `Color: ${item.color || 'Gold'}`,
        `Chain: ${[item.chainType, item.chainLength].filter(Boolean).join(' - ') || 'Not applicable'}`,
        `Quantity: ${item.quantity}`,
        `Unit Price: ${formatPrice(item.price)}`,
        `Line Total: ${formatPrice(item.price * item.quantity)}`,
    ];

    return details.join('\n');
}).join('\n\n');

const getGiftEmailDetails = (gift = {}) => [
    `Gift Order: ${gift.isGift ? 'Yes' : 'No'}`,
    `Packaging Type: ${gift.isGift ? gift.packagingType || 'Standard RajVan Jewelry Box' : 'Not selected'}`,
    `Packaging Fee: ${gift.isGift ? formatPrice(gift.packagingFee || 0) : 'Free'}`,
    `Gift Message: ${gift.isGift && gift.message ? gift.message : 'Not provided'}`,
    `Gift Occasion: ${gift.isGift && gift.occasion ? gift.occasion : 'Not provided'}`,
    `Hide Invoice: ${gift.isGift && gift.hideInvoice ? 'Yes' : 'No'}`,
].join('\n');

const getPaymentEmailDetails = (payment = {}) => [
    `Payment Method: ${payment.method || 'Not selected'}`,
    `Payment Status: ${payment.status || 'Pending'}`,
    `Transaction ID: ${payment.transactionId || 'Not provided'}`,
    `Screenshot File Name: ${payment.screenshotFileName || 'Not uploaded'}`,
].join('\n');

const logEmailJSPayload = (label, serviceId, templateId, params) => {
    console.group(`[RajVan EmailJS] ${label} email request`);
    console.info('Service ID:', serviceId);
    console.info('Template ID:', templateId);
    console.info('To Email:', params.to_email);
    console.info('Required customer variables:', {
        to_email: params.to_email,
        to_name: params.to_name,
        order_id: params.order_id,
        total: params.total,
        payment_method: params.payment_method,
        payment_status: params.payment_status,
    });
    console.info('Full params:', params);
    console.groupEnd();
};

const sendEmailJSTemplate = async ({ label, serviceId, templateId, params }) => {
    logEmailJSPayload(label, serviceId, templateId, params);

    if (!templateId) {
        throw new Error(`${label} template ID is missing.`);
    }

    if (!params.to_email) {
        throw new Error(`${label} recipient email is missing.`);
    }

    try {
        const response = await window.emailjs.send(serviceId, templateId, params);
        console.info(`[RajVan EmailJS] ${label} email success response:`, response);
        return {
            sent: true,
            response,
        };
    } catch (error) {
        console.error(`[RajVan EmailJS] ${label} email failure response:`, error);
        return {
            sent: false,
            error,
        };
    }
};

const initEmailJS = () => {
    if (!window.emailjs) {
        console.error('[RajVan EmailJS] EmailJS browser SDK is not loaded.');
        return false;
    }

    const configIssues = getEmailJSConfigIssues();

    if (configIssues.length) {
        console.error(`[RajVan EmailJS] Missing or placeholder configuration: ${configIssues.join(', ')}.`);
        return false;
    }

    const config = getEmailJSConfig();
    window.emailjs.init({ publicKey: config.publicKey });
    console.info('[RajVan EmailJS] EmailJS initialized.');
    return true;
};

const sendOrderEmails = async (order) => {
    if (sentEmailOrderIds.has(order.orderId)) {
        console.warn(`[RajVan EmailJS] Duplicate email send prevented for order ${order.orderId}.`);
        return {
            sent: true,
            skippedDuplicate: true,
            reason: 'Duplicate email send prevented for this order.',
        };
    }

    if (!initEmailJS()) {
        const missingConfig = getEmailJSConfigIssues();
        return {
            sent: false,
            reason: missingConfig.length
                ? `EmailJS is not configured. Missing: ${missingConfig.join(', ')}.`
                : 'EmailJS is not available. Make sure the EmailJS browser SDK loads on checkout.html.',
        };
    }

    const products = getProductsText(order.cart);
    const productDetails = getProductEmailDetails(order.cart);
    const address = getFullAddress(order.customer);
    const gift = order.gift || {};
    const giftDetails = getGiftEmailDetails(gift);
    const paymentDetails = getPaymentEmailDetails(order.payment);
    const totalsDetails = [
        `Subtotal: ${formatPrice(order.totals.subtotal)}`,
        `Delivery: ${order.totals.deliveryFee ? formatPrice(order.totals.deliveryFee) : 'Free'}`,
        `Gift Packaging: ${order.totals.giftPackagingFee ? formatPrice(order.totals.giftPackagingFee) : 'Free'}`,
        `Discount: ${formatPrice(order.totals.discount)}`,
        `Total Amount: ${formatPrice(order.totals.total)}`,
    ].join('\n');
    const orderNotes = `${giftDetails}\n\n${paymentDetails}`;
    const ownerOrderDetails = [
        `Order ID: ${order.orderId}`,
        '',
        'Customer Details',
        `Name: ${order.customer.fullName}`,
        `Mobile Number: ${order.customer.mobile}`,
        `Email: ${order.customer.email}`,
        `Delivery Address: ${address}`,
        '',
        'Product Details',
        productDetails,
        '',
        'Gift Details',
        giftDetails,
        '',
        'Payment Details',
        paymentDetails,
        '',
        'Order Total',
        totalsDetails,
    ].join('\n');
    const customerConfirmation = [
        `Thank you for your order, ${order.customer.fullName}!`,
        '',
        `Your RajVan Jewelry order ${order.orderId} has been received successfully.`,
        '',
        'Product Details',
        productDetails,
        '',
        `Total: ${formatPrice(order.totals.total)}`,
        `Payment Method: ${order.payment.method}`,
        `Payment Status: ${order.payment.status}`,
        '',
        'Next Steps',
        '1. Our team will review your customization details.',
        '2. Personalized jewellery will be crafted after order confirmation.',
        '3. You will be contacted if any detail needs clarification.',
        '4. Your order will be packed and dispatched as per the selected delivery option.',
    ].join('\n');
    const commonParams = {
        order_id: order.orderId,
        customer_name: order.customer.fullName,
        customer_email: order.customer.email,
        customer_phone: order.customer.mobile,
        customer_address: address,
        products: `${products}\n\n${orderNotes}`,
        product_details: productDetails,
        customization_details: productDetails,
        order_notes: orderNotes,
        owner_order_details: ownerOrderDetails,
        customer_confirmation: customerConfirmation,
        customer_message: customerConfirmation,
        owner_message: ownerOrderDetails,
        next_steps: 'We will review your customization, craft your jewellery, and dispatch it as per the selected delivery option.',
        subtotal: formatPrice(order.totals.subtotal),
        delivery: order.totals.deliveryFee ? formatPrice(order.totals.deliveryFee) : 'Free',
        gift_packaging_total: order.totals.giftPackagingFee ? formatPrice(order.totals.giftPackagingFee) : 'Free',
        discount: formatPrice(order.totals.discount),
        total: formatPrice(order.totals.total),
        payment_method: order.payment.method,
        payment_status: order.payment.status,
        transaction_id: order.payment.transactionId || 'Not provided',
        payment_screenshot: order.payment.screenshotFileName || 'Not uploaded',
        payment_screenshot_note: order.payment.screenshotFileName
            ? `Payment screenshot uploaded by customer. File name: ${order.payment.screenshotFileName}. EmailJS browser emails cannot attach local files automatically.`
            : 'Payment screenshot was not uploaded.',
        gift_order: gift.isGift ? 'Yes' : 'No',
        gift_packaging: gift.isGift ? gift.packagingType : 'Not selected',
        gift_packaging_fee: gift.isGift ? formatPrice(gift.packagingFee || 0) : 'Free',
        gift_message: gift.isGift && gift.message ? gift.message : 'Not provided',
        gift_occasion: gift.isGift && gift.occasion ? gift.occasion : 'Not provided',
        hide_invoice: gift.isGift && gift.hideInvoice ? 'Yes' : 'No',
    };

    const config = getEmailJSConfig();
    const customerParams = {
        ...commonParams,
        to_email: order.customer.email,
        to_name: order.customer.fullName,
        user_email: order.customer.email,
        customer_email: order.customer.email,
        email: order.customer.email,
        name: order.customer.fullName,
        reply_to: STORE_OWNER_EMAIL,
        email_subject: `RajVan Jewelry Order Confirmed - ${order.orderId}`,
        subject: `RajVan Jewelry Order Confirmed - ${order.orderId}`,
    };
    const ownerParams = {
        ...commonParams,
        to_email: STORE_OWNER_EMAIL,
        to_name: 'RajVan Jewelry',
        user_email: STORE_OWNER_EMAIL,
        email: STORE_OWNER_EMAIL,
        owner_email: STORE_OWNER_EMAIL,
        reply_to: order.customer.email,
        email_subject: `New RajVan Jewelry Order - ${order.orderId}`,
        subject: `New RajVan Jewelry Order - ${order.orderId}`,
        complete_customer_information: ownerOrderDetails,
        complete_order_information: ownerOrderDetails,
    };

    console.info(`[RajVan EmailJS] Config loaded for order ${order.orderId}:`, {
        serviceId: config.serviceId,
        customerTemplateId: config.customerTemplateId,
        ownerTemplateId: config.ownerTemplateId,
        publicKeyLoaded: Boolean(config.publicKey),
    });
    console.info(`[RajVan EmailJS] Sending customer email first, then owner email for order ${order.orderId}.`);
    sentEmailOrderIds.add(order.orderId);

    const customerResult = await sendEmailJSTemplate({
        label: 'Customer confirmation',
        serviceId: config.serviceId,
        templateId: config.customerTemplateId,
        params: customerParams,
    });

    const ownerResult = await sendEmailJSTemplate({
        label: 'Store owner',
        serviceId: config.serviceId,
        templateId: config.ownerTemplateId,
        params: ownerParams,
    });

    const failures = [
        !customerResult.sent ? 'Customer confirmation email failed' : '',
        !ownerResult.sent ? 'Store owner email failed' : '',
    ].filter(Boolean);

    if (failures.length) {
        sentEmailOrderIds.delete(order.orderId);
        const emailError = new Error(failures.join('; '));
        emailError.customerResult = customerResult;
        emailError.ownerResult = ownerResult;
        console.error('[RajVan EmailJS] One or more emails failed.', {
            customerResult,
            ownerResult,
        });
        throw emailError;
    }

    return {
        sent: true,
        customerSent: customerResult.sent,
        ownerSent: ownerResult.sent,
        ownerEmail: STORE_OWNER_EMAIL,
        customerEmail: order.customer.email,
        customerResponse: customerResult.response,
        ownerResponse: ownerResult.response,
    };
};

const createOrderId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `RV-${timestamp}-${random}`;
};

const getCartCount = () => getCart().reduce((total, item) => total + item.quantity, 0);

const getWishlist = () => {
    try {
        return JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
};

const saveWishlist = (wishlist) => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    updateWishlistCount();
};

const getUsers = () => {
    try {
        return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
};

const getActiveUser = () => {
    try {
        return JSON.parse(localStorage.getItem(ACTIVE_USER_STORAGE_KEY));
    } catch {
        return null;
    }
};

const updateCartCount = () => {
    document.querySelectorAll('.nav-links a[href="cart.html"]').forEach((link) => {
        let badge = link.querySelector('.cart-count');

        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-count';
            link.appendChild(badge);
        }

        badge.textContent = getCartCount();
    });
};

const updateWishlistCount = () => {
    document.querySelectorAll('.nav-links a[href="wishlist.html"]').forEach((link) => {
        let badge = link.querySelector('.wishlist-count');

        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-count wishlist-count';
            link.appendChild(badge);
        }

        badge.textContent = getWishlist().length;
    });
};

const enhanceNavbar = () => {
    document.querySelectorAll('.nav-links').forEach((nav) => {
        if (!nav.querySelector('a[href="custom-pendant.html"]')) {
            const customItem = document.createElement('li');
            customItem.innerHTML = '<a href="custom-pendant.html">Custom Pendant</a>';
            const cartItem = nav.querySelector('a[href="cart.html"]')?.parentElement;
            nav.insertBefore(customItem, cartItem || null);
        }

        if (!nav.querySelector('a[href="faq.html"]')) {
            const faqItem = document.createElement('li');
            faqItem.innerHTML = '<a href="faq.html">FAQ</a>';
            const cartItem = nav.querySelector('a[href="cart.html"]')?.parentElement;
            nav.insertBefore(faqItem, cartItem || null);
        }

        if (!nav.querySelector('a[href="wishlist.html"]')) {
            const wishlistItem = document.createElement('li');
            wishlistItem.innerHTML = '<a href="wishlist.html">♡ Wishlist</a>';
            const cartItem = nav.querySelector('a[href="cart.html"]')?.parentElement;
            nav.insertBefore(wishlistItem, cartItem || null);
        }

        if (!nav.querySelector('.account-link')) {
            const user = getActiveUser();
            const accountItem = document.createElement('li');
            accountItem.innerHTML = user
                ? '<a href="my-account.html" class="account-link">Profile</a>'
                : '<a href="login.html" class="account-link">Login</a>';
            nav.appendChild(accountItem);
        }
    });
};

const enhanceFooter = () => {
    document.querySelectorAll('.footer-links').forEach((footerLinks) => {
        if (footerLinks.querySelector('[data-info-links]')) {
            return;
        }

        const infoColumn = document.createElement('div');
        infoColumn.setAttribute('data-info-links', 'true');
        infoColumn.innerHTML = `
            <h3>Information</h3>
            <a href="faq.html">FAQ</a>
            <a href="shipping-policy.html">Shipping Policy</a>
            <a href="return-refund-policy.html">Return & Refund Policy</a>
            <a href="privacy-policy.html">Privacy Policy</a>
            <a href="terms-conditions.html">Terms & Conditions</a>
        `;
        footerLinks.appendChild(infoColumn);
    });
};

const addToCart = (product) => {
    const cart = getCart();
    const productWithKey = {
        ...product,
        cartKey: product.cartKey || buildCartKey(product),
    };
    const existingItem = cart.find((item) => (item.cartKey || buildCartKey(item)) === productWithKey.cartKey);

    if (existingItem) {
        existingItem.quantity += productWithKey.quantity;
        existingItem.cartKey = existingItem.cartKey || buildCartKey(existingItem);
    } else {
        cart.push(productWithKey);
    }

    saveCart(cart);
};

const getProductFromCard = (card) => {
    const image = card.querySelector('img');
    const name = card.dataset.name || card.querySelector('h3')?.textContent.trim() || 'RajVan Jewelry';
    const priceText = card.dataset.price || card.querySelector('.product-info p')?.textContent.replace(/\D/g, '') || '0';

    return {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        price: Number(priceText),
        color: 'Gold',
        quantity: 1,
        image: image ? image.src : '',
    };
};

const getCartDetails = (item) => {
    const details = [];

    if (item.color) {
        details.push(`Color: ${item.color}`);
    }

    if (item.displayName || item.customName) {
        details.push(`Name: ${item.displayName || item.customName}`);
    }

    if (item.font) {
        details.push(`Font: ${item.font}`);
    }

    if (item.chainType) {
        details.push(`Chain Type: ${item.chainType}`);
    }

    if (item.chainLength) {
        details.push(`Chain Length: ${item.chainLength}`);
    }

    if (item.pendantStyle || item.pendantSize) {
        details.push(`Pendant Style: ${item.pendantStyle || item.pendantSize}`);
    }

    if (item.bangleSize) {
        details.push(`Bangle Size: ${item.bangleSize}`);
    }

    if (item.bangleStyle) {
        details.push(`Bangle Style: ${item.bangleStyle}`);
    }

    return details;
};

const getProductFromDetailPage = () => {
    const selectedColor = document.querySelector('#selected-color')?.textContent.trim() || 'Gold';
    const quantity = Number(document.querySelector('#quantity-input')?.value) || 1;
    const name = document.querySelector('.product-detail-info h1')?.textContent.trim() || 'RajVan Jewelry';
    const priceText = document.querySelector('.current-price')?.textContent.replace(/\D/g, '') || '0';
    const image = document.querySelector('#main-product-image')?.src || '';

    return {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        price: Number(priceText),
        color: selectedColor,
        quantity,
        image,
    };
};

const renderCartPage = () => {
    const cartItems = document.querySelector('#cart-items');
    const cartLayout = document.querySelector('#cart-layout');
    const cartEmpty = document.querySelector('#cart-empty');
    const subtotalElement = document.querySelector('#cart-subtotal');
    const grandTotalElement = document.querySelector('#cart-grand-total');

    if (!cartItems || !cartLayout || !cartEmpty) {
        return;
    }

    const cart = getCart();
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

    cartLayout.classList.toggle('is-hidden', cart.length === 0);
    cartEmpty.classList.toggle('is-visible', cart.length === 0);
    cartItems.innerHTML = '';

    cart.forEach((item) => {
        const itemSubtotal = item.price * item.quantity;
        const row = document.createElement('article');
        row.className = 'cart-item';
        row.innerHTML = `
            <div class="cart-item-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-info">
                <h2>${item.name}</h2>
                <p>${getCartDetails(item).join(' | ')}</p>
                <div class="cart-item-controls">
                    <div class="cart-quantity" aria-label="Update quantity">
                        <button type="button" data-cart-action="decrease" data-key="${item.cartKey || buildCartKey(item)}">-</button>
                        <span>${item.quantity}</span>
                        <button type="button" data-cart-action="increase" data-key="${item.cartKey || buildCartKey(item)}">+</button>
                    </div>
                    <button type="button" class="remove-cart-item" data-cart-action="remove" data-key="${item.cartKey || buildCartKey(item)}">Remove</button>
                </div>
            </div>
            <div class="cart-item-price">
                <div><span>Price</span><strong>${formatPrice(item.price)}</strong></div>
                <div><span>Subtotal</span><strong>${formatPrice(itemSubtotal)}</strong></div>
            </div>
        `;
        cartItems.appendChild(row);
    });

    if (subtotalElement) {
        subtotalElement.textContent = formatPrice(subtotal);
    }

    if (grandTotalElement) {
        grandTotalElement.textContent = formatPrice(subtotal);
    }
};

const updateCartItem = (cartKey, action) => {
    const cart = getCart();
    const item = cart.find((cartItem) => (cartItem.cartKey || buildCartKey(cartItem)) === cartKey);

    if (!item) {
        return;
    }

    if (action === 'increase') {
        item.quantity += 1;
    }

    if (action === 'decrease') {
        item.quantity -= 1;
    }

    const updatedCart = action === 'remove' || item.quantity <= 0
        ? cart.filter((cartItem) => (cartItem.cartKey || buildCartKey(cartItem)) !== cartKey)
        : cart;

    saveCart(updatedCart);
    renderCartPage();
    renderCheckoutPage();
};

const getCheckoutTotals = () => {
    const cart = getCart();
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const deliveryFee = Number(document.querySelector('input[name="delivery"]:checked')?.dataset.fee || 0);
    const isGift = document.querySelector('#gift-order-toggle')?.checked || false;
    const giftPackagingFee = isGift
        ? Number(document.querySelector('input[name="giftPackaging"]:checked')?.dataset.fee || 0)
        : 0;

    return {
        subtotal,
        deliveryFee,
        giftPackagingFee,
        discount: 0,
        total: Math.max(subtotal + deliveryFee + giftPackagingFee, 0),
    };
};

const buildUpiDeepLink = (amount, transactionRef = createOrderId()) => {
    const params = new URLSearchParams({
        pa: UPI_ID,
        pn: UPI_MERCHANT_NAME,
        am: Number(amount).toFixed(2),
        cu: 'INR',
        tn: 'RajVan Jewelry Order',
        tr: transactionRef,
    });

    return `upi://pay?${params.toString()}`;
};

const buildUpiIntentLink = (amount, transactionRef = createOrderId()) => {
    const params = new URLSearchParams({
        pa: UPI_ID,
        pn: UPI_MERCHANT_NAME,
        am: Number(amount).toFixed(2),
        cu: 'INR',
        tn: 'RajVan Jewelry Order',
        tr: transactionRef,
    });

    return `intent://pay?${params.toString()}#Intent;scheme=upi;end`;
};

const renderCheckoutPage = () => {
    const checkoutItems = document.querySelector('#checkout-items');
    const checkoutForm = document.querySelector('#checkout-form');
    const checkoutEmpty = document.querySelector('#checkout-empty');

    if (!checkoutItems || !checkoutForm || !checkoutEmpty) {
        return;
    }

    const cart = getCart();
    checkoutForm.classList.toggle('is-hidden', cart.length === 0);
    checkoutEmpty.classList.toggle('is-visible', cart.length === 0);
    checkoutItems.innerHTML = '';

    cart.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'checkout-item';
        row.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div>
                <h3>${item.name}</h3>
                <p>${getCartDetails(item).join(' | ')} | Qty ${item.quantity}</p>
            </div>
            <strong>${formatPrice(item.price * item.quantity)}</strong>
        `;
        checkoutItems.appendChild(row);
    });

    const totals = getCheckoutTotals();
    document.querySelector('#checkout-subtotal').textContent = formatPrice(totals.subtotal);
    document.querySelector('#checkout-delivery').textContent = totals.deliveryFee ? formatPrice(totals.deliveryFee) : 'Free';
    const giftRow = document.querySelector('#checkout-gift-row');
    const giftFee = document.querySelector('#checkout-gift-fee');
    giftRow?.classList.toggle('is-hidden', totals.giftPackagingFee === 0);
    if (giftFee) {
        giftFee.textContent = totals.giftPackagingFee ? formatPrice(totals.giftPackagingFee) : 'Free';
    }
    document.querySelector('#checkout-total').textContent = formatPrice(totals.total);
};

const renderOrderSuccessPage = () => {
    const successPage = document.querySelector('#order-success-page');

    if (!successPage) {
        return;
    }

    let order = null;

    try {
        order = JSON.parse(localStorage.getItem(LAST_ORDER_STORAGE_KEY));
    } catch {
        order = null;
    }

    const emptyState = document.querySelector('#order-success-empty');
    const detailState = document.querySelector('#order-success-detail');

    if (!order) {
        emptyState?.classList.add('is-visible');
        detailState?.classList.add('is-hidden');
        return;
    }

    emptyState?.classList.remove('is-visible');
    detailState?.classList.remove('is-hidden');

    const customerName = order.customer?.fullName || 'Customer';
    const orderItems = document.querySelector('#success-order-items');
    const orderId = document.querySelector('#success-order-id');
    const orderName = document.querySelector('#success-customer-name');
    const paymentStatus = document.querySelector('#success-payment-status');
    const paymentMethod = document.querySelector('#success-payment-method');
    const transactionId = document.querySelector('#success-transaction-id');
    const screenshotFile = document.querySelector('#success-screenshot-file');
    const giftOrder = document.querySelector('#success-gift-order');
    const giftPackaging = document.querySelector('#success-gift-packaging');
    const giftOccasion = document.querySelector('#success-gift-occasion');
    const hideInvoice = document.querySelector('#success-hide-invoice');
    const giftMessage = document.querySelector('#success-gift-message');
    const giftFee = document.querySelector('#success-gift-fee');
    const subtotal = document.querySelector('#success-subtotal');
    const delivery = document.querySelector('#success-delivery');
    const discount = document.querySelector('#success-discount');
    const total = document.querySelector('#success-total');
    const gift = order.gift || {};

    if (orderId) {
        orderId.textContent = order.orderId;
    }

    if (orderName) {
        orderName.textContent = customerName;
    }

    if (paymentStatus) {
        paymentStatus.textContent = order.payment?.status || order.customer?.paymentStatus || 'Pending';
    }

    if (paymentMethod) {
        paymentMethod.textContent = order.payment?.method || 'Not selected';
    }

    if (transactionId) {
        transactionId.textContent = order.payment?.transactionId || order.customer?.transactionId || 'Not provided';
    }

    if (screenshotFile) {
        screenshotFile.textContent = order.payment?.screenshotFileName || 'Not uploaded';
    }

    if (giftOrder) {
        giftOrder.textContent = gift.isGift ? 'Yes' : 'No';
    }

    if (giftPackaging) {
        giftPackaging.textContent = gift.isGift ? gift.packagingType : 'Not selected';
    }

    if (giftOccasion) {
        giftOccasion.textContent = gift.isGift && gift.occasion ? gift.occasion : 'Not provided';
    }

    if (hideInvoice) {
        hideInvoice.textContent = gift.isGift && gift.hideInvoice ? 'Yes' : 'No';
    }

    if (giftMessage) {
        giftMessage.textContent = gift.isGift && gift.message ? gift.message : 'Not provided';
    }

    if (giftFee) {
        giftFee.textContent = gift.isGift && gift.packagingFee ? formatPrice(gift.packagingFee) : 'Free';
    }

    if (orderItems) {
        orderItems.innerHTML = '';
        order.cart.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'checkout-item';
            row.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div>
                    <h3>${item.name}</h3>
                    <p>${getCartDetails(item).join(' | ')} | Qty ${item.quantity}</p>
                </div>
                <strong>${formatPrice(item.price * item.quantity)}</strong>
            `;
            orderItems.appendChild(row);
        });
    }

    if (subtotal) {
        subtotal.textContent = formatPrice(order.totals.subtotal);
    }

    if (delivery) {
        delivery.textContent = order.totals.deliveryFee ? formatPrice(order.totals.deliveryFee) : 'Free';
    }

    if (discount) {
        discount.textContent = formatPrice(order.totals.discount);
    }

    if (total) {
        total.textContent = formatPrice(order.totals.total);
    }
};

const showMessage = (element, message, type) => {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.remove('is-error', 'is-success');
    element.classList.add(type === 'success' ? 'is-success' : 'is-error');
};

const toggleWishlist = (product) => {
    const wishlist = getWishlist();
    const productId = product.id;
    const exists = wishlist.some((item) => item.id === productId);
    const nextWishlist = exists
        ? wishlist.filter((item) => item.id !== productId)
        : [...wishlist, product];

    saveWishlist(nextWishlist);
    updateWishlistButtons();
};

const updateWishlistButtons = () => {
    const wishlistIds = getWishlist().map((item) => item.id);

    document.querySelectorAll('.wishlist-btn').forEach((button) => {
        const card = button.closest('.product-card');
        const product = card ? getProductFromCard(card) : null;
        const isActive = product && wishlistIds.includes(product.id);

        button.classList.toggle('active', Boolean(isActive));
        button.setAttribute('aria-label', isActive ? 'Remove from wishlist' : 'Add to wishlist');
        button.textContent = isActive ? '♥' : '♡';
    });
};

const initProductCardWishlist = () => {
    document.querySelectorAll('.product-card').forEach((card) => {
        const imageWrap = card.querySelector('.product-image');

        if (!imageWrap || imageWrap.querySelector('.wishlist-btn')) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wishlist-btn';
        button.textContent = '♡';
        button.setAttribute('aria-label', 'Add to wishlist');
        imageWrap.appendChild(button);
    });

    document.querySelectorAll('.wishlist-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const card = button.closest('.product-card');
            if (card) {
                toggleWishlist(getProductFromCard(card));
            }
        });
    });

    updateWishlistButtons();
};

const renderWishlistPage = () => {
    const wishlistGrid = document.querySelector('#wishlist-items');
    const emptyState = document.querySelector('#wishlist-empty');
    const layout = document.querySelector('#wishlist-layout');

    if (!wishlistGrid || !emptyState || !layout) {
        return;
    }

    const wishlist = getWishlist();
    wishlistGrid.innerHTML = '';
    layout.classList.toggle('is-hidden', wishlist.length === 0);
    emptyState.classList.toggle('is-visible', wishlist.length === 0);

    wishlist.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'product-card wishlist-card';
        card.innerHTML = `
            <div class="product-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="product-info">
                <h3>${item.name}</h3>
                <p>${formatPrice(item.price)}</p>
                <button type="button" data-wishlist-action="move" data-id="${item.id}">Move to Cart</button>
                <button type="button" class="remove-cart-item" data-wishlist-action="remove" data-id="${item.id}">Remove</button>
            </div>
        `;
        wishlistGrid.appendChild(card);
    });
};

const initWishlistPage = () => {
    const wishlistGrid = document.querySelector('#wishlist-items');

    if (!wishlistGrid) {
        return;
    }

    wishlistGrid.addEventListener('click', (event) => {
        const button = event.target.closest('[data-wishlist-action]');

        if (!button) {
            return;
        }

        const wishlist = getWishlist();
        const item = wishlist.find((product) => product.id === button.dataset.id);

        if (!item) {
            return;
        }

        if (button.dataset.wishlistAction === 'move') {
            addToCart({ ...item, quantity: 1, color: item.color || 'Gold' });
        }

        saveWishlist(wishlist.filter((product) => product.id !== item.id));
        renderWishlistPage();
    });

    renderWishlistPage();
};

const CUSTOM_FONT_LABELS = {
    'great-vibes': 'Great Vibes',
    allura: 'Allura',
    'dancing-script': 'Dancing Script',
    parisienne: 'Parisienne',
    'alex-brush': 'Alex Brush',
    'pinyon-script': 'Pinyon Script',
    sacramento: 'Sacramento',
    cinzel: 'Cinzel',
    montserrat: 'Montserrat',
    'bebas-neue': 'Bebas Neue',
};

const fontMap = {
    'great-vibes': "'Great Vibes', cursive",
    allura: "'Allura', cursive",
    'dancing-script': "'Dancing Script', cursive",
    parisienne: "'Parisienne', cursive",
    'alex-brush': "'Alex Brush', cursive",
    'pinyon-script': "'Pinyon Script', cursive",
    sacramento: "'Sacramento', cursive",
    cinzel: "'Cinzel', serif",
    montserrat: "'Montserrat', sans-serif",
    'bebas-neue': "'Bebas Neue', sans-serif",
};

const CUSTOM_COLOR_VALUES = {
    Gold: '#d4af37',
    'Rose Gold': '#c98f7a',
    Silver: '#c7ced2',
};

const getCustomFontLabel = (select) => select?.selectedOptions?.[0]?.textContent?.trim() || CUSTOM_FONT_LABELS[select?.value] || 'Great Vibes';

const applyCustomFont = (preview, fontKey) => {
    if (preview) {
        preview.style.fontFamily = fontMap[fontKey] || fontMap['great-vibes'];
    }
};

const sanitizeCustomName = (input, maxLength = 12) => input.value.replace(/[^a-zA-Z -]/g, '').slice(0, maxLength);

const getConnectorSymbol = (connector) => connector === 'Infinity' ? '\u221e' : '\u2764\ufe0f';

const getPendantPrice = ({ displayName = '', pendantType = 'Single Name', chainType = '', pendantStyle = '' }) => {
    const length = displayName.replace(/[^a-zA-Z]/g, '').length;
    let price = length <= 5 ? 999 : length <= 8 ? 1099 : 1199;

    if (pendantType === 'Couple Name') {
        price += 350;
    }

    if (chainType === 'Box Chain' || chainType === 'Rope Chain') {
        price += 100;
    }

    if (pendantStyle === 'Heart Accent Style') {
        price += 150;
    }

    return price;
};

const getBanglePrice = ({ displayName = '', bangleSize = '2.4', bangleStyle = '' }) => {
    const length = displayName.replace(/[^a-zA-Z]/g, '').length;
    let price = length <= 5 ? 1299 : length <= 8 ? 1399 : 1499;

    if (bangleSize === '2.8') {
        price += 100;
    }

    if (bangleStyle === 'Stone Accent Name Bangle') {
        price += 200;
    }

    return price;
};

const updateCustomPreviewColor = (preview, color) => {
    const colorValue = CUSTOM_COLOR_VALUES[color] || CUSTOM_COLOR_VALUES.Gold;
    preview?.style.setProperty('--preview-metal', colorValue);
};

const saveCustomBuilderProduct = ({ product, message, redirectTo }) => {
    addToCart(product);
    updateCartCount();
    showMessage(message, `${product.name} added to cart.`, 'success');
    window.setTimeout(() => {
        window.location.href = redirectTo;
    }, 350);
};

const initCustomPendantPage = () => {
    const form = document.querySelector('#custom-pendant-form');
    const preview = document.querySelector('#pendant-preview');
    const previewName = document.querySelector('#pendant-preview-name');
    const previewColor = document.querySelector('#pendant-preview-color');
    const previewFont = document.querySelector('#pendant-preview-font');
    const previewStyle = document.querySelector('#pendant-preview-style');
    const singleNameInput = document.querySelector('#pendant-name');
    const nameOneInput = document.querySelector('#pendant-name-one');
    const nameTwoInput = document.querySelector('#pendant-name-two');
    const fontSelect = document.querySelector('#pendant-font');
    const charCount = document.querySelector('#pendant-char-count');
    const nameOneCount = document.querySelector('#pendant-name-one-count');
    const nameTwoCount = document.querySelector('#pendant-name-two-count');
    const priceElement = document.querySelector('#pendant-price');
    const quantityInput = document.querySelector('#pendant-quantity');
    const message = document.querySelector('#pendant-message');
    const buyNowButton = document.querySelector('#pendant-buy-now');

    if (!form || !previewName || !priceElement || !quantityInput) {
        return;
    }

    const getState = () => {
        const formData = new FormData(form);
        const pendantType = formData.get('pendantType') || 'Single Name';
        const color = formData.get('color') || 'Gold';
        const font = formData.get('font') || 'great-vibes';
        const fontLabel = getCustomFontLabel(fontSelect);
        const connector = formData.get('connector') || 'Heart';
        const name = singleNameInput.value.trim();
        const nameOne = nameOneInput.value.trim();
        const nameTwo = nameTwoInput.value.trim();
        const displayName = pendantType === 'Couple Name'
            ? `${nameOne || 'Olivia'} ${getConnectorSymbol(connector)} ${nameTwo || 'Emily'}`
            : name || 'RajVan';
        const chainType = formData.get('chainType') || 'Classic Cable Chain';
        const chainLength = formData.get('chainLength') || '18 inch';
        const pendantStyle = formData.get('pendantStyle') || 'Classic Name Cutout';
        const quantity = Number(quantityInput.value) || 1;
        const price = getPendantPrice({ displayName, pendantType, chainType, pendantStyle });

        return {
            pendantType,
            color,
            font,
            fontLabel,
            connector,
            name,
            nameOne,
            nameTwo,
            displayName,
            chainType,
            chainLength,
            pendantStyle,
            quantity,
            price,
        };
    };

    const togglePendantTypeFields = () => {
        const isCouple = form.querySelector('input[name="pendantType"]:checked')?.value === 'Couple Name';
        document.querySelector('#single-name-field')?.classList.toggle('is-hidden', isCouple);
        document.querySelectorAll('.couple-field').forEach((field) => field.classList.toggle('is-hidden', !isCouple));
        singleNameInput.required = !isCouple;
        nameOneInput.required = isCouple;
        nameTwoInput.required = isCouple;
    };

    const updatePreview = () => {
        const cleanSingleName = sanitizeCustomName(singleNameInput, 12);
        const cleanNameOne = sanitizeCustomName(nameOneInput, 10);
        const cleanNameTwo = sanitizeCustomName(nameTwoInput, 10);

        if (cleanSingleName !== singleNameInput.value) {
            singleNameInput.value = cleanSingleName;
        }

        if (cleanNameOne !== nameOneInput.value) {
            nameOneInput.value = cleanNameOne;
        }

        if (cleanNameTwo !== nameTwoInput.value) {
            nameTwoInput.value = cleanNameTwo;
        }

        togglePendantTypeFields();
        const state = getState();
        previewName.textContent = state.displayName;
        previewName.className = `pendant-name-preview font-${state.font}`;
        applyCustomFont(previewName, state.font);
        updateCustomPreviewColor(preview, state.color);
        preview?.classList.toggle('style-minimal', state.pendantStyle === 'Minimal Bar Style');
        preview?.classList.toggle('style-heart', state.pendantStyle === 'Heart Accent Style');
        if (previewColor) {
            previewColor.textContent = `${state.color} Finish`;
        }
        if (previewFont) {
            previewFont.textContent = state.fontLabel;
        }
        if (previewStyle) {
            previewStyle.textContent = state.pendantStyle;
        }
        if (charCount) {
            charCount.textContent = `${state.name.length}/12`;
        }
        if (nameOneCount) {
            nameOneCount.textContent = `${state.nameOne.length}/10`;
        }
        if (nameTwoCount) {
            nameTwoCount.textContent = `${state.nameTwo.length}/10`;
        }
        priceElement.textContent = formatPrice(state.price * state.quantity);
    };

    const buildProduct = () => {
        const state = getState();
        const missingName = state.pendantType === 'Couple Name'
            ? !state.nameOne || !state.nameTwo
            : !state.name;

        if (missingName) {
            showMessage(message, state.pendantType === 'Couple Name'
                ? 'Please enter both names for your couple pendant.'
                : 'Please enter the name for your pendant.', 'error');
            return null;
        }

        if (!/^[a-zA-Z -]+$/.test(state.pendantType === 'Couple Name' ? `${state.nameOne} ${state.nameTwo}` : state.name)) {
            showMessage(message, 'Use only letters, hyphen, and spaces in names.', 'error');
            return null;
        }

        return {
            id: `custom-name-pendant-${state.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: `Custom Name Pendant - ${state.displayName}`,
            productName: 'Custom Name Pendant',
            price: state.price,
            color: state.color,
            quantity: state.quantity,
            image: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=900&q=85',
            customName: state.pendantType === 'Couple Name' ? state.nameOne : state.name,
            customNameTwo: state.pendantType === 'Couple Name' ? state.nameTwo : '',
            displayName: state.displayName,
            font: state.fontLabel,
            fontKey: state.font,
            pendantType: state.pendantType,
            connector: state.pendantType === 'Couple Name' ? state.connector : '',
            chainType: state.chainType,
            chainLength: state.chainLength,
            pendantStyle: state.pendantStyle,
        };
    };

    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);

    document.querySelectorAll('[data-pendant-quantity]').forEach((button) => {
        button.addEventListener('click', () => {
            const currentValue = Number(quantityInput.value) || 1;
            quantityInput.value = button.dataset.pendantQuantity === 'increase'
                ? Math.min(currentValue + 1, 10)
                : Math.max(currentValue - 1, 1);
            updatePreview();
        });
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const product = buildProduct();
        if (product) {
            saveCustomBuilderProduct({ product, message, redirectTo: 'cart.html' });
        }
    });

    buyNowButton?.addEventListener('click', () => {
        const product = buildProduct();
        if (product) {
            saveCustomBuilderProduct({ product, message, redirectTo: 'checkout.html' });
        }
    });

    updatePreview();
};

const initCustomBanglePage = () => {
    const form = document.querySelector('#custom-bangle-form');
    const preview = document.querySelector('#bangle-preview');
    const previewName = document.querySelector('#bangle-preview-name');
    const previewColor = document.querySelector('#bangle-preview-color');
    const previewFont = document.querySelector('#bangle-preview-font');
    const nameInput = document.querySelector('#bangle-name');
    const fontSelect = document.querySelector('#bangle-font');
    const charCount = document.querySelector('#bangle-char-count');
    const priceElement = document.querySelector('#bangle-price');
    const quantityInput = document.querySelector('#bangle-quantity');
    const message = document.querySelector('#bangle-message');
    const buyNowButton = document.querySelector('#bangle-buy-now');

    if (!form || !previewName || !priceElement || !quantityInput || !nameInput) {
        return;
    }

    const getState = () => {
        const formData = new FormData(form);
        const displayName = nameInput.value.trim() || 'RajVan';
        const color = formData.get('color') || 'Gold';
        const font = formData.get('font') || 'great-vibes';
        const fontLabel = getCustomFontLabel(fontSelect);
        const bangleSize = formData.get('bangleSize') || '2.4';
        const bangleStyle = formData.get('bangleStyle') || 'Classic Name Bangle';
        const quantity = Number(quantityInput.value) || 1;
        const price = getBanglePrice({ displayName, bangleSize, bangleStyle });

        return {
            displayName,
            color,
            font,
            fontLabel,
            bangleSize,
            bangleStyle,
            quantity,
            price,
        };
    };

    const updatePreview = () => {
        const cleanName = sanitizeCustomName(nameInput);
        if (cleanName !== nameInput.value) {
            nameInput.value = cleanName;
        }

        const state = getState();
        previewName.textContent = state.displayName;
        previewName.className = `pendant-name-preview font-${state.font}`;
        applyCustomFont(previewName, state.font);
        updateCustomPreviewColor(preview, state.color);
        if (previewColor) {
            previewColor.textContent = `${state.color} Finish`;
        }
        if (previewFont) {
            previewFont.textContent = state.fontLabel;
        }
        if (charCount) {
            charCount.textContent = `${nameInput.value.trim().length}/12`;
        }
        priceElement.textContent = formatPrice(state.price * state.quantity);
    };

    const buildProduct = () => {
        const state = getState();

        if (!nameInput.value.trim()) {
            showMessage(message, 'Please enter a name for your bangle.', 'error');
            return null;
        }

        return {
            id: `custom-name-bangle-${state.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: `Custom Name Bangle - ${state.displayName}`,
            productName: 'Custom Name Bangle',
            price: state.price,
            color: state.color,
            quantity: state.quantity,
            image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=85',
            customName: state.displayName,
            font: state.fontLabel,
            fontKey: state.font,
            bangleSize: state.bangleSize,
            bangleStyle: state.bangleStyle,
        };
    };

    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);

    document.querySelectorAll('[data-bangle-quantity]').forEach((button) => {
        button.addEventListener('click', () => {
            const currentValue = Number(quantityInput.value) || 1;
            quantityInput.value = button.dataset.bangleQuantity === 'increase'
                ? Math.min(currentValue + 1, 10)
                : Math.max(currentValue - 1, 1);
            updatePreview();
        });
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const product = buildProduct();
        if (product) {
            saveCustomBuilderProduct({ product, message, redirectTo: 'cart.html' });
        }
    });

    buyNowButton?.addEventListener('click', () => {
        const product = buildProduct();
        if (product) {
            saveCustomBuilderProduct({ product, message, redirectTo: 'checkout.html' });
        }
    });

    updatePreview();
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const initAuthPages = () => {
    const registerForm = document.querySelector('#register-form');
    const loginForm = document.querySelector('#login-form');
    const forgotForm = document.querySelector('#forgot-form');
    const message = document.querySelector('.auth-message');

    registerForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(registerForm).entries());
        const users = getUsers();

        if (!data.fullName || !validateEmail(data.email) || !/^[0-9]{10}$/.test(data.mobile) || data.password.length < 6) {
            showMessage(message, 'Please enter valid registration details.', 'error');
            return;
        }

        if (data.password !== data.confirmPassword) {
            showMessage(message, 'Passwords do not match.', 'error');
            return;
        }

        if (users.some((user) => user.email.toLowerCase() === data.email.toLowerCase())) {
            showMessage(message, 'An account with this email already exists.', 'error');
            return;
        }

        const user = {
            id: `USR-${Date.now()}`,
            fullName: data.fullName,
            email: data.email,
            mobile: data.mobile,
            addresses: [],
            createdAt: new Date().toISOString(),
        };

        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...users, { ...user, password: data.password }]));
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user));
        window.location.href = 'my-account.html';
    });

    loginForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(loginForm).entries());
        const user = getUsers().find((item) => item.email.toLowerCase() === data.email.toLowerCase() && item.password === data.password);

        if (!user) {
            showMessage(message, 'Invalid email or password.', 'error');
            return;
        }

        const { password, ...safeUser } = user;
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(safeUser));
        localStorage.setItem('rajvanRememberMe', data.remember ? 'true' : 'false');
        window.location.href = 'my-account.html';
    });

    forgotForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = new FormData(forgotForm).get('email');

        if (!validateEmail(email)) {
            showMessage(message, 'Please enter a valid email address.', 'error');
            return;
        }

        showMessage(message, 'Password reset UI is ready. Backend email flow can be connected later.', 'success');
    });
};

const renderMyAccountPage = () => {
    const accountPage = document.querySelector('#my-account-page');

    if (!accountPage) {
        return;
    }

    const user = getActiveUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const orders = getStoredOrders().filter((order) => order.customer?.email?.toLowerCase() === user.email.toLowerCase());
    document.querySelector('#account-name').textContent = user.fullName;
    document.querySelector('#account-name-copy').textContent = user.fullName;
    document.querySelector('#account-email').textContent = user.email;
    document.querySelector('#account-mobile').textContent = user.mobile;
    document.querySelector('#account-orders-count').textContent = orders.length;
    document.querySelector('#account-wishlist-count').textContent = getWishlist().length;
    document.querySelector('#account-address-count').textContent = user.addresses?.length || 0;

    const ordersWrap = document.querySelector('#account-orders');
    ordersWrap.innerHTML = orders.length
        ? orders.map((order) => `<div class="summary-row"><span>${order.orderId}</span><strong>${formatPrice(order.totals.total)}</strong></div>`).join('')
        : '<p class="muted-text">No orders yet.</p>';

    document.querySelector('#logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
        window.location.href = 'login.html';
    });
};

const initFAQPage = () => {
    document.querySelectorAll('.faq-question').forEach((button) => {
        button.addEventListener('click', () => {
            const item = button.closest('.faq-item');
            item?.classList.toggle('is-open');
        });
    });
};

const initContactPage = () => {
    const contactForm = document.querySelector('#contact-form');
    const contactMessage = document.querySelector('#contact-message');

    if (!contactForm) {
        return;
    }

    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!contactForm.checkValidity()) {
            contactForm.reportValidity();
            showMessage(contactMessage, 'Please fill all contact details correctly.', 'error');
            return;
        }

        contactForm.reset();
        showMessage(contactMessage, 'Thank you. Your message has been saved for support follow-up.', 'success');
    });
};

const initMenu = () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (!menuToggle || !navLinks) {
        return;
    }

    menuToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('is-open');
        menuToggle.classList.toggle('is-open', isOpen);
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            navLinks.classList.remove('is-open');
            menuToggle.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });
};

const initNewsletter = () => {
    const newsletterForm = document.querySelector('.newsletter-form');

    if (!newsletterForm) {
        return;
    }

    newsletterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = newsletterForm.querySelector('input');

        if (input && input.value.trim()) {
            input.value = '';
            input.placeholder = 'Thank you for subscribing';
        }
    });
};

const initShopFilters = () => {
    const productSearch = document.querySelector('#product-search');
    const sortProducts = document.querySelector('#sort-products');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const shopProductGrid = document.querySelector('#shop-product-grid');
    const productCount = document.querySelector('#product-count');
    const emptyMessage = document.querySelector('#empty-message');

    if (!shopProductGrid) {
        return;
    }

    const productCards = Array.from(shopProductGrid.querySelectorAll('.shop-product-card'));
    let activeCategory = 'all';

    const updateProducts = () => {
        const searchTerm = productSearch ? productSearch.value.trim().toLowerCase() : '';
        const sortValue = sortProducts ? sortProducts.value : 'featured';
        const sortedCards = [...productCards].sort((firstCard, secondCard) => {
            const firstPrice = Number(firstCard.dataset.price);
            const secondPrice = Number(secondCard.dataset.price);

            if (sortValue === 'low-high') {
                return firstPrice - secondPrice;
            }

            if (sortValue === 'high-low') {
                return secondPrice - firstPrice;
            }

            return productCards.indexOf(firstCard) - productCards.indexOf(secondCard);
        });

        sortedCards.forEach((card) => shopProductGrid.appendChild(card));

        let visibleCount = 0;
        sortedCards.forEach((card) => {
            const productName = card.dataset.name.toLowerCase();
            const productCategory = card.dataset.category;
            const isVisible = productName.includes(searchTerm) && (activeCategory === 'all' || productCategory === activeCategory);

            card.classList.toggle('is-hidden', !isVisible);
            if (isVisible) {
                visibleCount += 1;
            }
        });

        if (productCount) {
            productCount.textContent = visibleCount;
        }

        if (emptyMessage) {
            emptyMessage.classList.toggle('is-visible', visibleCount === 0);
        }
    };

    productSearch?.addEventListener('input', updateProducts);
    sortProducts?.addEventListener('change', updateProducts);

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.category;
            filterButtons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            updateProducts();
        });
    });

    updateProducts();
};

const initProductPage = () => {
    const mainProductImage = document.querySelector('#main-product-image');
    const thumbnailButtons = document.querySelectorAll('.thumbnail-btn');
    const colorOptions = document.querySelectorAll('.color-option');
    const selectedColor = document.querySelector('#selected-color');
    const quantityInput = document.querySelector('#quantity-input');
    const quantityButtons = document.querySelectorAll('.quantity-btn');

    if (mainProductImage && thumbnailButtons.length) {
        thumbnailButtons.forEach((button) => {
            button.addEventListener('click', () => {
                mainProductImage.src = button.dataset.image;
                mainProductImage.alt = button.dataset.alt;
                thumbnailButtons.forEach((item) => item.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }

    if (colorOptions.length && selectedColor) {
        colorOptions.forEach((button) => {
            button.addEventListener('click', () => {
                colorOptions.forEach((item) => item.classList.remove('active'));
                button.classList.add('active');
                selectedColor.textContent = button.dataset.color;
            });
        });
    }

    if (quantityInput && quantityButtons.length) {
        quantityButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const currentValue = Number(quantityInput.value) || 1;
                const minValue = Number(quantityInput.min) || 1;
                const maxValue = Number(quantityInput.max) || 10;
                quantityInput.value = button.dataset.action === 'increase'
                    ? Math.min(currentValue + 1, maxValue)
                    : Math.max(currentValue - 1, minValue);
            });
        });

        quantityInput.addEventListener('input', () => {
            const minValue = Number(quantityInput.min) || 1;
            const maxValue = Number(quantityInput.max) || 10;
            const currentValue = Number(quantityInput.value) || minValue;
            quantityInput.value = Math.min(Math.max(currentValue, minValue), maxValue);
        });
    }
};

const initAddToCart = () => {
    document.querySelectorAll('.product-card .product-info button').forEach((button) => {
        button.addEventListener('click', () => {
            const card = button.closest('.product-card');
            addToCart(getProductFromCard(card));
            button.textContent = 'Added';
            setTimeout(() => {
                button.textContent = 'Add to Cart';
            }, 1100);
        });
    });

    const detailCartButton = document.querySelector('.cart-btn');
    const buyNowButton = document.querySelector('.buy-btn');

    detailCartButton?.addEventListener('click', () => {
        addToCart(getProductFromDetailPage());
        detailCartButton.textContent = 'Added to Cart';
        setTimeout(() => {
            detailCartButton.textContent = 'Add to Cart';
        }, 1100);
    });

    buyNowButton?.addEventListener('click', () => {
        addToCart(getProductFromDetailPage());
        window.location.href = 'checkout.html';
    });
};

const initCartPage = () => {
    const cartItems = document.querySelector('#cart-items');

    if (!cartItems) {
        return;
    }

    cartItems.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cart-action]');

        if (!button) {
            return;
        }

        updateCartItem(button.dataset.key, button.dataset.cartAction);
    });

    renderCartPage();
};

const initCheckoutPage = () => {
    const checkoutForm = document.querySelector('#checkout-form');
    const checkoutMessage = document.querySelector('#checkout-message');
    const upiPanel = document.querySelector('#upi-payment-panel');
    const screenshotInput = document.querySelector('#payment-screenshot');
    const upiAppButton = document.querySelector('#upi-app-btn');
    const giftToggle = document.querySelector('#gift-order-toggle');
    const giftOptions = document.querySelector('#gift-options');
    const giftMessage = document.querySelector('#gift-message');
    const giftMessageCount = document.querySelector('#gift-message-count');

    if (!checkoutForm) {
        return;
    }

    document.querySelectorAll('input[name="delivery"]').forEach((input) => {
        input.addEventListener('change', renderCheckoutPage);
    });

    const updateGiftFields = () => {
        const isGift = giftToggle?.checked || false;
        giftOptions?.classList.toggle('is-hidden', !isGift);

        if (!isGift && giftOptions) {
            giftOptions.querySelectorAll('textarea, select').forEach((field) => {
                field.value = '';
            });
            const standardPackaging = giftOptions.querySelector('input[name="giftPackaging"][data-fee="0"]');
            if (standardPackaging) {
                standardPackaging.checked = true;
            }
            const hideInvoice = giftOptions.querySelector('input[name="hideInvoice"]');
            if (hideInvoice) {
                hideInvoice.checked = false;
            }
            if (giftMessageCount) {
                giftMessageCount.textContent = '0/150';
            }
        }

        renderCheckoutPage();
    };

    giftToggle?.addEventListener('change', updateGiftFields);
    checkoutForm.querySelectorAll('input[name="giftPackaging"]').forEach((input) => {
        input.addEventListener('change', renderCheckoutPage);
    });
    giftMessage?.addEventListener('input', () => {
        if (giftMessageCount) {
            giftMessageCount.textContent = `${giftMessage.value.length}/150`;
        }
    });

    const updatePaymentFields = () => {
        const selectedPayment = checkoutForm.querySelector('input[name="paymentMethod"]:checked')?.value;
        const isUPI = selectedPayment === 'UPI Payment';

        upiPanel?.classList.toggle('is-hidden', !isUPI);

        if (screenshotInput) {
            screenshotInput.required = isUPI;
            if (!isUPI) {
                screenshotInput.value = '';
            }
        }
    };

    checkoutForm.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
        input.addEventListener('change', updatePaymentFields);
    });

    upiAppButton?.addEventListener('click', () => {
        const { total } = getCheckoutTotals();
        const transactionRef = createOrderId();
        const upiLink = buildUpiDeepLink(total, transactionRef);
        const intentLink = buildUpiIntentLink(total, transactionRef);
        window.location.assign(upiLink);

        window.setTimeout(() => {
            if (/Android/i.test(navigator.userAgent) && !document.hidden) {
                window.location.assign(intentLink);
            }
        }, 700);
    });

    checkoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = checkoutForm.querySelector('.place-order-btn');
        updatePaymentFields();

        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            showMessage(checkoutMessage, 'Please fill all required details correctly.', 'error');
            return;
        }

        if (getCart().length === 0) {
            showMessage(checkoutMessage, 'Your cart is empty.', 'error');
            return;
        }

        const formValues = Object.fromEntries(new FormData(checkoutForm).entries());
        const paymentMethod = formValues.paymentMethod;
        const isUPI = paymentMethod === 'UPI Payment';
        const screenshotFileName = screenshotInput?.files?.[0]?.name || '';
        const isGift = giftToggle?.checked || false;
        const selectedGiftPackaging = checkoutForm.querySelector('input[name="giftPackaging"]:checked');
        const giftPackagingFee = isGift ? Number(selectedGiftPackaging?.dataset.fee || 0) : 0;
        const totals = getCheckoutTotals();

        if (isUPI && !screenshotFileName) {
            showMessage(checkoutMessage, 'Please upload the UPI payment screenshot before placing the order.', 'error');
            screenshotInput?.focus();
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Placing Order...';
        }

        const orderPayload = {
            orderId: createOrderId(),
            customer: {
                fullName: formValues.fullName,
                mobile: formValues.mobile,
                email: formValues.email,
                address: formValues.address,
                city: formValues.city,
                state: formValues.state,
                pin: formValues.pin,
            },
            delivery: {
                type: formValues.delivery,
                fee: totals.deliveryFee,
            },
            payment: {
                method: paymentMethod,
                status: isUPI ? 'Paid via UPI' : 'Cash on Delivery',
                transactionId: isUPI ? formValues.transactionId?.trim() || '' : '',
                screenshotFileName: isUPI ? screenshotFileName : '',
                upiId: UPI_ID,
                mobile: '+91 98765 43210',
            },
            gift: {
                isGift,
                packagingType: isGift ? selectedGiftPackaging?.value || 'Standard RajVan Jewelry Box' : '',
                packagingFee: giftPackagingFee,
                message: isGift ? formValues.giftMessage?.trim() || '' : '',
                occasion: isGift ? formValues.giftOccasion || '' : '',
                hideInvoice: isGift && formValues.hideInvoice === 'on',
            },
            cart: getCart(),
            totals,
            status: 'placed',
            createdAt: new Date().toISOString(),
        };

        try {
            const emailResult = await sendOrderEmails(orderPayload);
            orderPayload.email = emailResult;
            saveOrder(orderPayload);
            localStorage.removeItem(CART_STORAGE_KEY);
            updateCartCount();
            showMessage(checkoutMessage, 'Order placed successfully. Redirecting...', 'success');
            window.location.href = 'order-success.html';
        } catch (error) {
            orderPayload.email = {
                sent: false,
                reason: 'EmailJS send failed. Order saved locally for follow-up.',
            };
            saveOrder(orderPayload);
            localStorage.removeItem(CART_STORAGE_KEY);
            updateCartCount();
            showMessage(checkoutMessage, 'Order placed. Email sending failed, but order details were saved. Redirecting...', 'success');
            window.setTimeout(() => {
                window.location.href = 'order-success.html';
            }, 900);
        }
    });

    updatePaymentFields();
    updateGiftFields();
    renderCheckoutPage();
};

document.addEventListener('DOMContentLoaded', () => {
    enhanceNavbar();
    enhanceFooter();
    initMenu();
    initNewsletter();
    initShopFilters();
    initProductPage();
    initProductCardWishlist();
    initAddToCart();
    initCartPage();
    initCheckoutPage();
    initWishlistPage();
    initCustomPendantPage();
    initCustomBanglePage();
    initAuthPages();
    renderMyAccountPage();
    initFAQPage();
    initContactPage();
    renderOrderSuccessPage();
    updateCartCount();
    updateWishlistCount();
});
