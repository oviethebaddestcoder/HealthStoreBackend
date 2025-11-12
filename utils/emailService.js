import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOrderConfirmationEmail = async (order, userEmail, userName = 'Customer') => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Health Excellence <hello@healthexcellence.shop>', // Replace with your verified domain
      to: [userEmail],
      subject: `Order Confirmation - #${order.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
                .order-details { background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0; }
                .order-item { padding: 10px 0; border-bottom: 1px solid #eee; }
                .total { font-weight: bold; font-size: 1.1em; margin-top: 15px; }
                .status { display: inline-block; padding: 5px 10px; border-radius: 3px; background: #ffc107; color: #000; }
                .paid { background: #28a745; color: #fff; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Order Confirmation</h1>
                    <p>Thank you for your purchase, ${userName}!</p>
                </div>
                
                <div class="order-details">
                    <h2>Order #${order.id}</h2>
                    <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span class="status ${order.payment_status === 'success' ? 'paid' : ''}">${order.order_status}</span></p>
                    
                    <h3>Shipping Address</h3>
                    <p>${order.address}<br>
                    ${order.city}, ${order.state}<br>
                    ${order.phone ? `Phone: ${order.phone}` : ''}</p>
                    
                    <h3>Order Items</h3>
                    ${order.order_items.map(item => `
                        <div class="order-item">
                            <strong>${item.product_name}</strong><br>
                            Quantity: ${item.quantity} × ₦${item.price.toLocaleString()}
                        </div>
                    `).join('')}
                    
                    <div class="total">
                        <p>Subtotal: ₦${order.subtotal.toLocaleString()}</p>
                        <p>Delivery Fee: ₦${order.delivery_fee.toLocaleString()}</p>
                        <p>Total: ₦${order.total.toLocaleString()}</p>
                    </div>
                </div>
                
                <p>We'll notify you when your order ships. If you have any questions, please contact our support team.</p>
            </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    console.log('Order confirmation email sent successfully');
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    return { success: false, error };
  }
};