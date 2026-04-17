import { ValueObject } from '@shared/domain';

export enum ApprovalRuleType {
  ALL = 'ALL',
  ANY = 'ANY',
  QUORUM = 'QUORUM',
}

interface ApprovalRuleProps {
  type: ApprovalRuleType;
  quorumCount?: number;
}

export class ApprovalRule extends ValueObject<ApprovalRuleProps> {
  get type(): ApprovalRuleType {
    return this.props.type;
  }

  get quorumCount(): number | undefined {
    return this.props.quorumCount;
  }

  static all(): ApprovalRule {
    return new ApprovalRule({ type: ApprovalRuleType.ALL });
  }

  static any(): ApprovalRule {
    return new ApprovalRule({ type: ApprovalRuleType.ANY });
  }

  static quorum(count: number): ApprovalRule {
    if (count < 1) throw new Error('Quorum count must be at least 1');
    return new ApprovalRule({ type: ApprovalRuleType.QUORUM, quorumCount: count });
  }

  isSatisfiedBy(approvedCount: number, totalApprovers: number): boolean {
    if (approvedCount === 0) return false;

    switch (this.props.type) {
      case ApprovalRuleType.ALL:
        return approvedCount >= totalApprovers;
      case ApprovalRuleType.ANY:
        return approvedCount >= 1;
      case ApprovalRuleType.QUORUM:
        return approvedCount >= (this.props.quorumCount ?? 1);
    }
  }
}
