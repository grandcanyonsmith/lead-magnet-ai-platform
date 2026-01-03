import { ensureRequiredFields } from "../../utils/formFieldUtils";

describe("formFieldUtils.ensureRequiredFields", () => {
  it("adds name/email/phone fields as optional (required=false) when missing", () => {
    const fields = [
      {
        field_id: "company",
        field_type: "text",
        label: "Company",
        required: true,
      },
    ] as any[];

    const result = ensureRequiredFields(fields);

    // Required-by-schema fields should be injected at the beginning
    expect(result[0]).toMatchObject({ field_id: "name", required: false });
    expect(result[1]).toMatchObject({ field_id: "email", required: false });
    expect(result[2]).toMatchObject({ field_id: "phone", required: false });
    expect(result[3]).toMatchObject({ field_id: "company" });
  });
});

