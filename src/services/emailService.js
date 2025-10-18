const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // Debug: Log şifre uzunluğu (güvenlik için sadece uzunluk)
  console.log('SMTP Config Debug:');
  console.log('- Host:', process.env.SMTP_HOST);
  console.log('- Port:', process.env.SMTP_PORT);
  console.log('- User:', process.env.SMTP_USER);
  console.log('- Pass length:', process.env.SMTP_PASS?.length);
  console.log('- Secure:', process.env.SMTP_SECURE);

  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    },
    debug: true, // Enable debug output
    logger: true // Log to console
  };

  return nodemailer.createTransport(emailConfig);
};

// Extract base64 images from HTML content and return cleaned HTML + attachments
const extractImagesFromContent = (content, noteId) => {
  const attachments = [];
  let imageCounter = 0;

  // Find all base64 images in content
  const imgRegex = /<img[^>]+src="data:image\/(png|jpeg|jpg|gif|webp);base64,([^"]+)"[^>]*>/gi;

  let cleanedContent = content;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    imageCounter++;
    const imageType = match[1];
    const base64Data = match[2];
    const cid = `image-${noteId}-${imageCounter}`;

    // Add to attachments
    attachments.push({
      filename: `image-${imageCounter}.${imageType}`,
      content: base64Data,
      encoding: 'base64',
      cid: cid
    });

    // Replace base64 img with cid reference
    cleanedContent = cleanedContent.replace(match[0], `<img src="cid:${cid}" style="max-width: 100%; height: auto;" />`);
  }

  return { cleanedContent, attachments };
};

// Generate HTML email template for notes
const generateNotesEmailHTML = (notes, userName) => {
  const allAttachments = [];

  const notesHTML = notes.map(note => {
    const tagsHTML = note.tags && note.tags.length > 0
      ? `<div style="margin-top: 8px;">
          ${note.tags.map(tag =>
            `<span style="background: #6366f1; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px;">${tag}</span>`
          ).join('')}
         </div>`
      : '';

    // Extract images from content
    const { cleanedContent, attachments } = extractImagesFromContent(note.content, note.id);
    allAttachments.push(...attachments);

    return `
      <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #6366f1;">
        <h3 style="color: #f0f0f0; margin-top: 0;">${note.title}</h3>
        <div style="color: #b0b0b0; font-size: 14px; line-height: 1.6;">
          ${cleanedContent}
        </div>
        ${tagsHTML}
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #2a2a2e; font-size: 12px; color: #888;">
          ${note.lesson_title ? `Ders: ${note.lesson_title} • ` : ''}
          Oluşturulma: ${new Date(note.created_at).toLocaleDateString('tr-TR')}
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notlarınız - Serkan AI Lab</title>
    </head>
    <body style="font-family: Arial, sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 20px; margin: 0;">
      <div style="max-width: 800px; margin: 0 auto; background: #16162e; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #6366f1;">
          <h1 style="color: #6366f1; margin: 0; font-size: 28px;">📚 Notlarınız</h1>
          <p style="color: #888; margin: 10px 0 0 0; font-size: 14px;">Serkan AI Lab</p>
        </div>

        <!-- User Info -->
        <div style="background: #1a1a2e; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
          <p style="margin: 0; color: #b0b0b0;">
            <strong style="color: #f0f0f0;">Sayın ${userName},</strong><br>
            Aşağıda ${notes.length} adet notunuz bulunmaktadır.
          </p>
        </div>

        <!-- Notes -->
        ${notesHTML}

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2e; text-align: center; color: #888; font-size: 12px;">
          <p>Bu email <a href="https://ai.serkansentuna.com.tr" style="color: #6366f1; text-decoration: none;">Serkan AI Lab</a> platformu tarafından otomatik olarak gönderilmiştir.</p>
          <p style="margin-top: 10px;">${new Date().toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { htmlContent, attachments: allAttachments };
};

// Send notes via email
const sendNotesEmail = async (recipientEmail, userName, notes) => {
  try {
    const transporter = createTransporter();

    // Generate HTML content and extract attachments
    const { htmlContent, attachments } = generateNotesEmailHTML(notes, userName);

    console.log(`Sending email with ${attachments.length} image attachments`);

    // Email options
    const mailOptions = {
      from: {
        name: 'Serkan AI Lab',
        address: process.env.SMTP_FROM || process.env.SMTP_USER
      },
      to: recipientEmail,
      subject: `📚 Notlarınız (${notes.length} adet) - Serkan AI Lab`,
      html: htmlContent,
      // Plain text fallback
      text: `Notlarınız:\n\n${notes.map(note =>
        `${note.title}\n${note.content}\nTags: ${note.tags?.join(', ') || 'Yok'}\n---\n`
      ).join('\n')}`,
      // Add attachments (images)
      attachments: attachments
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      message: 'Email başarıyla gönderildi',
      attachmentCount: attachments.length
    };
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Email gönderilemedi: ${error.message}`);
  }
};

module.exports = {
  sendNotesEmail
};
