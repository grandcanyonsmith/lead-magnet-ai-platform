/**
 * DNS Record Preview Component
 * Shows a preview of DNS records that will be created
 */

import { Card } from "@/components/ui/Card";
import { InlineCode } from "@/components/ui/InlineCode";
import { FiArrowRight, FiCheck, FiAlertCircle } from "react-icons/fi";

interface DNSRecord {
  name: string;
  type: string;
  target: string;
  exists?: boolean;
}

interface DNSRecordPreviewProps {
  records: DNSRecord[];
  cloudfrontDomain: string;
}

export function DNSRecordPreview({
  records,
  cloudfrontDomain,
}: DNSRecordPreviewProps) {
  if (records.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          DNS Records Preview
        </h4>
        <div className="space-y-2">
          {records.map((record, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                record.exists
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
            >
              {record.exists ? (
                <FiAlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
              ) : (
                <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <InlineCode className="bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs">
                    {record.name}
                  </InlineCode>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {record.type}
                  </span>
                  <FiArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  <InlineCode className="bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs truncate max-w-[200px]">
                    {record.target}
                  </InlineCode>
                </div>
                {record.exists && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Record already exists
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          These records will be created in Cloudflare with DNS-only (gray cloud)
          proxy status.
        </p>
      </div>
    </Card>
  );
}
