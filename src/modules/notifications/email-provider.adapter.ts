export interface SendEmailPayload {
  to: string;
  recipientName: string;
  subject: string;
  html: string;
}

export interface IEmailProviderAdapter {
  sendEmail(payload: SendEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class MockEmailProviderAdapter implements IEmailProviderAdapter {
  async sendEmail(payload: SendEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Simulated realistic delivery (can simulate occasional transient failures for test verification)
    console.log(`[EmailAdapter] Mock email dispatched to ${payload.to}: "${payload.subject}"`);
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}
