import type { ReactElement } from 'react';

import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog } from '../../components/ui/dialog';
import { TextField } from '../../components/ui/text-field';

interface TableLayoutDialogViewProps {
  readonly applyLabel: string;
  readonly cancelLabel: string;
  readonly closeLabel: string;
  readonly columns: readonly {
    readonly id: string;
    readonly label: string;
    readonly visible: boolean;
  }[];
  readonly onApply: () => void;
  readonly onClose: () => void;
  readonly onToggleColumn: (id: string) => void;
  readonly onShowCashMovementsChange?: (value: boolean) => void;
  readonly showCashMovements?: boolean;
  readonly showCashMovementsLabel?: string;
  readonly onRiskUsdChange?: (value: string) => void;
  readonly riskUsd?: string;
  readonly riskUsdLabel?: string;
  readonly riskUsdHint?: string;
  readonly title: string;
}

export const TableLayoutDialogView = ({
  applyLabel,
  cancelLabel,
  closeLabel,
  columns,
  onApply,
  onClose,
  onToggleColumn,
  onShowCashMovementsChange,
  showCashMovements,
  showCashMovementsLabel,
  onRiskUsdChange,
  riskUsd,
  riskUsdLabel,
  riskUsdHint,
  title,
}: TableLayoutDialogViewProps): ReactElement => (
  <Dialog closeLabel={closeLabel} onOpenChange={(open) => !open && onClose()} open title={title}>
    <div className="table-layout-form">
      <div className="table-layout-columns">
        {columns.map((column) => (
          <label key={column.id}>
            <Checkbox
              ariaLabel={column.label}
              checked={column.visible}
              onCheckedChange={() => onToggleColumn(column.id)}
            />
            {column.label}
          </label>
        ))}
      </div>
      {onShowCashMovementsChange !== undefined &&
        showCashMovements !== undefined &&
        showCashMovementsLabel !== undefined && (
          <label className="table-layout-toggle">
            <Checkbox
              ariaLabel={showCashMovementsLabel}
              checked={showCashMovements}
              onCheckedChange={onShowCashMovementsChange}
            />
            {showCashMovementsLabel}
          </label>
        )}
      {onRiskUsdChange !== undefined && riskUsd !== undefined && riskUsdLabel !== undefined && (
        <label className="table-layout-risk">
          <span className="table-layout-risk-label">{riskUsdLabel}</span>
          <TextField
            aria-label={riskUsdLabel}
            inputMode="decimal"
            onChange={(event) => onRiskUsdChange(event.target.value)}
            placeholder={riskUsdLabel}
            value={riskUsd}
          />
          {riskUsdHint !== undefined && <span className="form-help">{riskUsdHint}</span>}
        </label>
      )}
    </div>
    <div className="ui-dialog-actions">
      <Button onClick={onClose} type="button" variant={BUTTON_VARIANTS.secondary}>
        {cancelLabel}
      </Button>
      <Button onClick={onApply} type="button">
        {applyLabel}
      </Button>
    </div>
  </Dialog>
);
