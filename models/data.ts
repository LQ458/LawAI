import mongoose, { Schema, Document, Model } from "mongoose";

interface Case extends Document {
  title: string;
  link: string;
  description: string;
  date: Date;
  content: string;
}

const caseSchema = new Schema<Case>({
  title: { type: String, required: true },
  link: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  content: { type: String, required: true },
});

caseSchema.index({ title: 'text', description: 'text', content: 'text' });

const CaseModel: Model<Case> = mongoose.models.Record || mongoose.model<Case>("Record", caseSchema);
export default CaseModel;
