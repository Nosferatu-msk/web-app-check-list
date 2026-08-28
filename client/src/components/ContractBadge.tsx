import { Tag, Tooltip } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

interface ContractBadgeProps {
  contractNumber?: string;
  compact?: boolean;
}

export default function ContractBadge({ contractNumber, compact }: ContractBadgeProps) {
  if (!contractNumber) return null;

  return (
    <Tooltip title={`Договор: ${contractNumber}`}>
      <Tag
        color="purple"
        icon={<FileTextOutlined />}
        style={{ whiteSpace: 'nowrap', margin: 0, fontSize: compact ? 11 : 12 }}
      >
        {contractNumber}
      </Tag>
    </Tooltip>
  );
}
