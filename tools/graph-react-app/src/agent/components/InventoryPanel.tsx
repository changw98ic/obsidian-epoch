import type { EpochProgressView, EpochShopOffer } from "../../types";

interface CraftRecipeOption {
  readonly value: string;
  readonly label: string;
  readonly cost: string;
}

interface InventoryPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly craftRecipeId: string;
  readonly craftRecipeOptions: readonly CraftRecipeOption[];
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly formatDate: (value?: string) => string;
  readonly formatShopCosts: (costs: EpochShopOffer["costs"]) => string;
  readonly hasExplorer: boolean;
  readonly isBusy: boolean;
  readonly onCraftInventoryItem: () => void;
  readonly onLoadShop: () => void;
  readonly onPurchaseShopOffer: () => void;
  readonly progress?: EpochProgressView | null;
  readonly selectedShopOffer?: EpochShopOffer | null;
  readonly setCraftRecipeId: (recipeId: string) => void;
  readonly setShopOfferId: (offerId: string) => void;
  readonly shopOfferId: string;
  readonly shopOffers: readonly EpochShopOffer[];
}

export function InventoryPanel({
  activeIdentityDisabled,
  craftRecipeId,
  craftRecipeOptions,
  epochAssetUrl,
  formatDate,
  formatShopCosts,
  hasExplorer,
  isBusy,
  onCraftInventoryItem,
  onLoadShop,
  onPurchaseShopOffer,
  progress,
  selectedShopOffer,
  setCraftRecipeId,
  setShopOfferId,
  shopOfferId,
  shopOffers,
}: InventoryPanelProps) {
  const inventoryItems = progress?.inventoryItems || [];
  const equipmentEffects = progress?.equipmentEffects || [];

  return (
    <article className="agent-panel">
      <div className="agent-panel-head">
        <span>背包</span>
        <b>{inventoryItems.length} items</b>
      </div>
      {inventoryItems.length ? (
        <div className="agent-mini-list">
          {inventoryItems.slice(0, 6).map((item) => (
            <span className="agent-item-media-row" key={item.itemId}>
              {item.media ? (
                <img
                  className="agent-item-media-image"
                  src={epochAssetUrl(item.media.imageUrl)}
                  alt={item.media.publicAlt}
                />
              ) : null}
              <span>
                <b>{item.displayName}</b>
                <em>{item.rarity} · {item.bound ? "已绑定" : "未绑定"} · {formatDate(item.createdAt)}</em>
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p>暂无服务器发放物品</p>
      )}
      {equipmentEffects.length ? (
        <div className="agent-mini-list agent-equipment-effects">
          {equipmentEffects.map((effect) => (
            <span key={effect.itemId}>
              <b>{effect.displayName}</b>
              <em>{effect.label}</em>
            </span>
          ))}
        </div>
      ) : (
        <p>暂无绑定装备效果</p>
      )}
      <div className="agent-action-row">
        <select value={craftRecipeId} onChange={(event) => setCraftRecipeId(event.target.value)}>
          {craftRecipeOptions.map((recipe) => (
            <option key={recipe.value} value={recipe.value}>{recipe.label} · {recipe.cost}</option>
          ))}
        </select>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !hasExplorer} onClick={onCraftInventoryItem}>制作</button>
      </div>
      <div className="agent-action-row">
        <select value={shopOfferId} onChange={(event) => setShopOfferId(event.target.value)}>
          {shopOffers.length ? shopOffers.map((offer) => (
            <option key={offer.offerId} value={offer.offerId}>{offer.displayName} · {formatShopCosts(offer.costs)}{offer.bindOnAcquire ? " · 绑定" : ""}</option>
          )) : (
            <option value="gray-ration-pack">灰市补给包 · 钱币3</option>
          )}
        </select>
        <button type="button" disabled={isBusy} onClick={onLoadShop}>商店</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !hasExplorer || !shopOfferId} onClick={onPurchaseShopOffer}>购买</button>
      </div>
      {selectedShopOffer?.media ? (
        <div className="agent-shop-offer-media" style={{ borderColor: selectedShopOffer.media.accentColor }}>
          <img
            className="agent-item-media-image"
            src={epochAssetUrl(selectedShopOffer.media.imageUrl)}
            alt={selectedShopOffer.media.publicAlt}
          />
          <span>
            <b>{selectedShopOffer.media.title}</b>
            <em>{selectedShopOffer.media.subtitle} · {formatShopCosts(selectedShopOffer.costs)}</em>
          </span>
        </div>
      ) : null}
    </article>
  );
}
