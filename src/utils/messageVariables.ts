interface Contact {
  name?: string;
  phone_number: string;
}

interface VariableData {
  var1?: string;
  var2?: string;
  var3?: string;
  [key: string]: string | undefined;
}

/**
 * Process message variables and replace them with actual values
 */
export const processMessageVariables = (
  message: string,
  contact: Contact,
  variableData?: VariableData
): string => {
  let processed = message;

  // Process random text selection FIRST (option1|option2|option3)
  const randomPattern = /\(([^)]+)\)/g;
  processed = processed.replace(randomPattern, (match, options) => {
    const choices = options.split('|').map((s: string) => s.trim());
    return choices[Math.floor(Math.random() * choices.length)];
  });

  // Replace [[NAME]] with WhatsApp contact name (or phone if name not available)
  processed = processed.replace(/\[\[NAME\]\]/g, contact.name || contact.phone_number);

  // Replace {nama} and {{nama}} with contact name from database
  processed = processed.replace(/\{\{?nama\}\}?/g, contact.name || contact.phone_number);

  // Replace {nomor} with phone number
  processed = processed.replace(/\{nomor\}/g, contact.phone_number);

  // Replace custom variables {var1}, {var2}, {var3}
  if (variableData) {
    Object.keys(variableData).forEach((key) => {
      const value = variableData[key];
      if (value) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        processed = processed.replace(regex, value);
      }
    });
  }

  // Replace time/date variables
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  
  // Support both {{waktu}} and {waktu}
  processed = processed.replace(/\{\{?waktu\}\}?/g, 
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
  
  // Support both {{tanggal}} and {tanggal}
  processed = processed.replace(/\{\{?tanggal\}\}?/g, 
    now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  );
  
  // Support both {{hari}} and {hari}
  processed = processed.replace(/\{\{?hari\}\}?/g, days[now.getDay()]);

  return processed;
};

/**
 * Preview message with example data
 */
export const previewMessageVariables = (message: string): string => {
  const exampleContact = {
    name: "John Doe",
    phone_number: "628123456789"
  };

  const exampleVars = {
    var1: "PROMO2024",
    var2: "Premium Package",
    var3: "31 Desember 2024"
  };

  return processMessageVariables(message, exampleContact, exampleVars);
};

/**
 * Validate if message contains valid variables
 */
export const validateMessageVariables = (message: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for unclosed parentheses in random selections
  const openParens = (message.match(/\(/g) || []).length;
  const closeParens = (message.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    errors.push("Tanda kurung tidak seimbang untuk random text");
  }

  // Check for empty random selections
  const emptyRandom = /\(\s*\)/g;
  if (emptyRandom.test(message)) {
    errors.push("Random text tidak boleh kosong");
  }

  // Check for invalid variable syntax
  const invalidVars = /\{(?![a-zA-Z0-9_]+\})/g;
  if (invalidVars.test(message)) {
    errors.push("Format variable tidak valid");
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
