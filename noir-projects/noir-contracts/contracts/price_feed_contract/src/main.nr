mod asset;

contract PriceFeed {
    use dep::aztec::prelude::{AztecAddress, FunctionSelector, PrivateContext, Map, PublicMutable};
    use crate::asset::Asset;

    // Storage structure, containing all storage, and specifying what slots they use.
    #[aztec(storage)]
    struct Storage {
        assets: Map<Field, PublicMutable<Asset>>,
    }

    #[aztec(public)]
    fn set_price(asset_id: Field, price: Field) {
        let asset = storage.assets.at(asset_id);
        asset.write(Asset { price: U128::from_integer(price) });
    }

    #[aztec(public)]
    #[aztec(view)]
    fn get_price(asset_id: Field) -> Asset {
        storage.assets.at(asset_id).read()
    }
}
