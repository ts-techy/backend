const nodemailer = require('nodemailer');


class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email configuration not found. Email service disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
    });
  }

  async sendCertificateLink(email, certificateId, fileName, internName, role, startDate, endDate) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const viewUrl = `${process.env.FRONTEND_URL}/view/${certificateId}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Your Internship Completion Certificate - TS Techy`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate Notification</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 0;
            color: #fff;
            background: #1f1f1f;
          }
          .wrapper {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .outer-container {
            background: #2a2a2a;
            padding: 30px;
            max-width: 600px;
            border-radius: 12px;
            box-shadow: 0px 8px 25px rgba(0, 0, 0, 0.4);
          }
          .container {
            background: #3a3a3a;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.3);
          }
          .header img {
            width: 140px;
            margin-bottom: 15px;
          }
          .header h2 {
            margin: 0;
            color: #f8b400;
            font-size: 22px;
          }
          .content {
            line-height: 1.8;
            color: #ddd;
            text-align: left;
            font-size: 16px;
          }
          .details {
            background: #444;
            padding: 20px;
            border-radius: 8px;
            margin-top: 15px;
            text-align: left;
          }
          .button-container {
            text-align: center;
            margin: 25px 0;
          }
          .view-button {
            background-color: #f8b400;
            color: #1f1f1f;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 500;
            font-size: 16px;
            display: inline-block;
          }
          .footer {
            margin-top: 20px;
            font-size: 14px;
            text-align: center;
            color: #bbb;
            border-top: 1px solid #555;
            padding-top: 15px;
          }
          a {
            color: #f8b400;
            text-decoration: none;
          }
          .highlight {
            color: #f8b400;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="outer-container">
            <div class="container">
              <div class="header">
                <img src="https://tstechy.com/wp-content/uploads/2025/04/TS-Techy4.png" alt="TS Techy Logo">
                <h2>Internship Completion Certificate</h2>
              </div>
              
              <div class="content">
                <p>Dear <span class="highlight">${internName}</span>,</p>
                <p>I hope you're doing well.</p>
                <p>It's a pleasure to share your Internship Completion Certificate for your time at TS Techy, from <span class="highlight">${startDate}</span> to <span class="highlight">${endDate}</span>, where you worked with us as a <span class="highlight">${role}</span>.</p>
                <p>Throughout your internship, you made valuable contributions to live projects, collaborated seamlessly with the team, and consistently demonstrated professionalism and a strong willingness to learn.</p>
                <p>We appreciate your dedication and wish you continued growth and success in your future endeavors.</p>
              </div>
              
              <div class="button-container">
                <a href="${viewUrl}" class="view-button">View Your Certificate</a>
              </div>
              
              <div class="details">
                <p><strong>Certificate Details:</strong></p>
                <p>Intern Name: ${internName}</p>
                <p>Role: ${role}</p>
                <p>Duration: ${startDate} to ${endDate}</p>
                <p>Certificate Link: <a href="${viewUrl}">${viewUrl}</a></p>
              </div>
              
              <div class="footer">
                <p>Best Regards,</p>
                <p><strong>TS Techy Team</strong></p>
                <p>
                  <a href="https://tstechy.com/" target="_blank">tstechy.com</a> | 
                  <a href="mailto:support@tstechy.com">support@tstechy.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();