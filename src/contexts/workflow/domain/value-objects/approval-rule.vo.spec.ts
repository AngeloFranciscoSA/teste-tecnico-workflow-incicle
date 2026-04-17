import { ApprovalRule, ApprovalRuleType } from './approval-rule.vo';

describe('ApprovalRule', () => {
  describe('ALL', () => {
    const rule = ApprovalRule.all();

    it('não é satisfeito sem nenhuma decisão', () => {
      expect(rule.isSatisfiedBy(0, 3)).toBe(false);
    });

    it('não é satisfeito com aprovações parciais', () => {
      expect(rule.isSatisfiedBy(2, 3)).toBe(false);
    });

    it('é satisfeito quando todos aprovam', () => {
      expect(rule.isSatisfiedBy(3, 3)).toBe(true);
    });

    it('type deve ser ALL', () => {
      expect(rule.type).toBe(ApprovalRuleType.ALL);
    });
  });

  describe('ANY', () => {
    const rule = ApprovalRule.any();

    it('não é satisfeito sem nenhuma decisão', () => {
      expect(rule.isSatisfiedBy(0, 3)).toBe(false);
    });

    it('é satisfeito com apenas uma aprovação', () => {
      expect(rule.isSatisfiedBy(1, 3)).toBe(true);
    });

    it('type deve ser ANY', () => {
      expect(rule.type).toBe(ApprovalRuleType.ANY);
    });
  });

  describe('QUORUM', () => {
    it('não é satisfeito abaixo do quórum', () => {
      const rule = ApprovalRule.quorum(3);
      expect(rule.isSatisfiedBy(2, 5)).toBe(false);
    });

    it('é satisfeito quando atinge exatamente o quórum', () => {
      const rule = ApprovalRule.quorum(3);
      expect(rule.isSatisfiedBy(3, 5)).toBe(true);
    });

    it('é satisfeito quando supera o quórum', () => {
      const rule = ApprovalRule.quorum(2);
      expect(rule.isSatisfiedBy(4, 5)).toBe(true);
    });

    it('type deve ser QUORUM', () => {
      const rule = ApprovalRule.quorum(2);
      expect(rule.type).toBe(ApprovalRuleType.QUORUM);
    });

    it('deve lançar erro se quórum for menor que 1', () => {
      expect(() => ApprovalRule.quorum(0)).toThrow();
    });
  });

  describe('quorumCount getter', () => {
    it('deve retornar o valor do quórum para regra QUORUM', () => {
      expect(ApprovalRule.quorum(3).quorumCount).toBe(3);
    });

    it('deve retornar undefined para regra ALL', () => {
      expect(ApprovalRule.all().quorumCount).toBeUndefined();
    });

    it('deve retornar undefined para regra ANY', () => {
      expect(ApprovalRule.any().quorumCount).toBeUndefined();
    });
  });

  describe('equals', () => {
    it('dois ALL devem ser iguais', () => {
      expect(ApprovalRule.all().equals(ApprovalRule.all())).toBe(true);
    });

    it('QUORUM(2) e QUORUM(3) devem ser diferentes', () => {
      expect(ApprovalRule.quorum(2).equals(ApprovalRule.quorum(3))).toBe(false);
    });

    it('ALL e ANY devem ser diferentes', () => {
      expect(ApprovalRule.all().equals(ApprovalRule.any())).toBe(false);
    });
  });
});
